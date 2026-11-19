"""Storing listening events exactly once (UC-15 A1, FR-53), with the play cap."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import ListeningEvent

# A 3-minute track on repeat gives 20 plays an hour; more is treated as inflation.
PLAYS_PER_TRACK_PER_HOUR = 20


class PlayLimitReached(Exception):
    """The user already had PLAYS_PER_TRACK_PER_HOUR plays of this track recently."""


def record_event(user, data: dict) -> tuple[ListeningEvent, bool]:
    """
    Store a validated event for `user`. Returns (event, created); a retry with the
    same client_event_id returns the stored event with created=False.

    Raises PlayLimitReached when a new `play` would exceed the per-track cap. The cap
    counts plays the *server received* in the last hour, so back-dated `occurred_at`
    values cannot be used to get around it.
    """
    client_event_id = data["client_event_id"]
    existing = ListeningEvent.objects.filter(user=user, client_event_id=client_event_id).first()
    if existing:
        return existing, False
    try:
        with transaction.atomic():
            # Serialize this user's writes so count-then-insert cannot race (TOCTOU).
            get_user_model().objects.select_for_update().filter(pk=user.pk).first()
            existing = ListeningEvent.objects.filter(
                user=user, client_event_id=client_event_id
            ).first()
            if existing:
                return existing, False
            if data["event_type"] == ListeningEvent.EventType.PLAY:
                recent_plays = ListeningEvent.objects.filter(
                    user=user,
                    song=data["song"],
                    event_type=ListeningEvent.EventType.PLAY,
                    received_at__gt=timezone.now() - timedelta(hours=1),
                ).count()
                if recent_plays >= PLAYS_PER_TRACK_PER_HOUR:
                    raise PlayLimitReached
            return ListeningEvent.objects.create(user=user, **data), True
    except IntegrityError:
        # A concurrent retry stored the same event first.
        return ListeningEvent.objects.get(user=user, client_event_id=client_event_id), False

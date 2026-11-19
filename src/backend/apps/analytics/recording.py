"""Storing listening events exactly once (UC-15 A1, FR-53)."""

from django.db import IntegrityError, transaction

from .models import ListeningEvent


def record_event(user, data: dict) -> tuple[ListeningEvent, bool]:
    """
    Store a validated event for `user`. Returns (event, created); a retry with the
    same client_event_id returns the stored event with created=False.
    """
    client_event_id = data["client_event_id"]
    existing = ListeningEvent.objects.filter(user=user, client_event_id=client_event_id).first()
    if existing:
        return existing, False
    try:
        with transaction.atomic():
            return ListeningEvent.objects.create(user=user, **data), True
    except IntegrityError:
        # A concurrent retry stored the same event first.
        return ListeningEvent.objects.get(user=user, client_event_id=client_event_id), False

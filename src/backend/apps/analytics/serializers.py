from datetime import date, datetime, timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.catalogue.models import Song
from apps.rooms.models import Room

from .models import ListeningEvent, PlaybackState
from .services import Interval

# Day-level series are filled with zero buckets, so bound the range to keep
# responses small and fast (NFR-07).
MAX_RANGE_DAYS = 366
DEFAULT_RANGE_DAYS = 30

# Offline events (FR-53) may carry the time they happened. Bounded so that a client
# cannot rewrite history; small clock skew into the future is tolerated.
MAX_EVENT_AGE = timedelta(days=7)
MAX_CLOCK_SKEW = timedelta(minutes=5)
MAX_BATCH_SIZE = 100


def _check_position(song: Song, position: int) -> None:
    if song.duration_seconds is not None and position > song.duration_seconds:
        raise serializers.ValidationError(
            {"position_seconds": "Position is beyond the end of the track."}
        )


class _PlayableSongMixin(serializers.Serializer):
    """Limits `song` to what the requesting user can play (catalogue visibility rule)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None:
            self.fields["song"].queryset = Song.objects.visible_to(request.user)


class ListeningEventSerializer(_PlayableSongMixin, serializers.ModelSerializer):
    """Write contract for players (web, room, mobile). Never exposes the listener."""

    song = serializers.PrimaryKeyRelatedField(queryset=Song.objects.none())
    # Any existing room, closed ones included: delivery can be delayed (offline sync,
    # FR-53) and the room only sets the context, it does not change any count.
    room = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.all(), required=False, allow_null=True
    )
    client_event_id = serializers.UUIDField()
    occurred_at = serializers.DateTimeField(
        required=False,
        write_only=True,
        help_text="When the action happened, for events sent after being offline. "
        "Defaults to the arrival time; at most 7 days old.",
    )
    context = serializers.CharField(read_only=True)

    class Meta:
        model = ListeningEvent
        fields = [
            "id",
            "client_event_id",
            "song",
            "event_type",
            "position_seconds",
            "room",
            "occurred_at",
            "context",
            "created_at",
        ]
        read_only_fields = ["id", "context", "created_at"]
        # The (user, client_event_id) constraint is handled by recording.record_event
        # so that a retried event returns the stored one instead of a validation error.
        validators: list = []

    def validate_occurred_at(self, value: datetime) -> datetime:
        now = timezone.now()
        if value > now + MAX_CLOCK_SKEW:
            raise serializers.ValidationError("Event time is in the future.")
        if value < now - MAX_EVENT_AGE:
            raise serializers.ValidationError("Event is too old to be recorded.")
        return value

    def validate(self, attrs: dict) -> dict:
        _check_position(attrs["song"], attrs.get("position_seconds", 0))
        occurred_at = attrs.pop("occurred_at", None)
        if occurred_at is not None:
            attrs["created_at"] = occurred_at
        return attrs


class EventBatchSerializer(serializers.Serializer):
    """Offline queue upload (FR-53). Items are validated one by one in the view."""

    events = serializers.ListField(
        child=serializers.DictField(), min_length=1, max_length=MAX_BATCH_SIZE
    )


class EventBatchResultSerializer(serializers.Serializer):
    client_event_id = serializers.CharField(allow_null=True)
    status = serializers.ChoiceField(choices=["created", "duplicate", "rejected"])
    errors = serializers.DictField(required=False)


class EventBatchResponseSerializer(serializers.Serializer):
    results = EventBatchResultSerializer(many=True)


class PlaybackStateSerializer(_PlayableSongMixin, serializers.ModelSerializer):
    """Recovery log entry (FR-53): what the user was playing and where."""

    song = serializers.PrimaryKeyRelatedField(queryset=Song.objects.none())
    room = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = PlaybackState
        fields = ["song", "position_seconds", "room", "updated_at"]
        read_only_fields = ["updated_at"]

    def validate(self, attrs: dict) -> dict:
        _check_position(attrs["song"], attrs.get("position_seconds", 0))
        return attrs


class StatsQuerySerializer(serializers.Serializer):
    """Query params for the dashboard (FR-38). Dates are inclusive, in TIME_ZONE."""

    start = serializers.DateField(required=False)
    end = serializers.DateField(required=False)
    interval = serializers.ChoiceField(
        choices=[i.value for i in Interval], default=Interval.DAY.value
    )

    def validate(self, attrs: dict) -> dict:
        end: date = attrs.get("end") or timezone.localdate()
        start: date = attrs.get("start") or end - timedelta(days=DEFAULT_RANGE_DAYS - 1)
        if start > end:
            raise serializers.ValidationError({"start": "Start date must not be after end date."})
        if (end - start).days + 1 > MAX_RANGE_DAYS:
            raise serializers.ValidationError(
                {"start": f"Range must not exceed {MAX_RANGE_DAYS} days."}
            )
        attrs["start"], attrs["end"] = start, end
        attrs["interval"] = Interval(attrs["interval"])
        return attrs


# --- Response shapes (also the OpenAPI contract for the dashboard UI) --------


class TrackStatsSerializer(serializers.Serializer):
    song_id = serializers.IntegerField()
    title = serializers.CharField()
    plays = serializers.IntegerField()
    skips = serializers.IntegerField()
    completions = serializers.IntegerField()


class PlaysPointSerializer(serializers.Serializer):
    period = serializers.DateField(help_text="First day of the day/week/month bucket.")
    plays = serializers.IntegerField()


class RangeSerializer(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()
    interval = serializers.CharField()
    tz = serializers.CharField(help_text="Time zone the dates and periods are in.")


class DashboardSerializer(serializers.Serializer):
    range = RangeSerializer()
    total_plays = serializers.IntegerField()
    tracks = TrackStatsSerializer(many=True)
    top_tracks = TrackStatsSerializer(many=True)
    plays_over_time = PlaysPointSerializer(many=True)


class SongStatsSerializer(serializers.Serializer):
    range = RangeSerializer()
    track = TrackStatsSerializer()
    plays_over_time = PlaysPointSerializer(many=True)

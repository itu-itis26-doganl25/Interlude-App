from datetime import date, timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.catalogue.models import Song
from apps.rooms.models import Room

from .models import ListeningEvent
from .services import Interval

# Day-level series are filled with zero buckets, so bound the range to keep
# responses small and fast (NFR-07).
MAX_RANGE_DAYS = 366
DEFAULT_RANGE_DAYS = 30


class ListeningEventSerializer(serializers.ModelSerializer):
    """Write contract for players (web, room, mobile). Never exposes the listener."""

    song = serializers.PrimaryKeyRelatedField(queryset=Song.objects.none())
    # Any existing room, closed ones included: delivery can be delayed (offline sync,
    # FR-53) and the room only sets the context, it does not change any count.
    room = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.all(), required=False, allow_null=True
    )
    client_event_id = serializers.UUIDField()
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
            "context",
            "created_at",
        ]
        read_only_fields = ["id", "context", "created_at"]
        # The (user, client_event_id) constraint is handled in the view so that a
        # retried event returns the stored one instead of a validation error.
        validators: list = []

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None:
            # Same visibility rule as the catalogue: only songs the user can play.
            self.fields["song"].queryset = Song.objects.visible_to(request.user)

    def validate(self, attrs: dict) -> dict:
        song: Song = attrs["song"]
        position = attrs.get("position_seconds", 0)
        if song.duration_seconds is not None and position > song.duration_seconds:
            raise serializers.ValidationError(
                {"position_seconds": "Position is beyond the end of the track."}
            )
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

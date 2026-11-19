from rest_framework import serializers

from apps.catalogue.models import Song
from apps.rooms.models import Room

from .models import ListeningEvent


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

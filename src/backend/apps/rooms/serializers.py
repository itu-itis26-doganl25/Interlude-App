"""Room API serializers (WBS-9.1)."""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.catalogue.models import Song

from .models import Room, RoomParticipant


class RoomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ["id", "username"]
        read_only_fields = fields


class RoomSongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Song
        fields = ["id", "title"]
        read_only_fields = fields


class ParticipantSerializer(serializers.ModelSerializer):
    user = RoomUserSerializer(read_only=True)

    class Meta:
        model = RoomParticipant
        fields = ["user", "joined_at"]
        read_only_fields = fields


class RoomSerializer(serializers.ModelSerializer):
    """A room in the room list (FR-27): name, host, participant count, current track."""

    host = RoomUserSerializer(read_only=True)
    current_song = RoomSongSerializer(read_only=True)
    participant_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Room
        fields = ["id", "name", "host", "participant_count", "current_song", "created_at"]
        read_only_fields = ["created_at"]

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Enter a room name.")
        return value


class RoomDetailSerializer(RoomSerializer):
    """The room page: everything in the list entry plus who is in the room."""

    participants = ParticipantSerializer(many=True, read_only=True)

    class Meta(RoomSerializer.Meta):
        fields = RoomSerializer.Meta.fields + ["participants"]

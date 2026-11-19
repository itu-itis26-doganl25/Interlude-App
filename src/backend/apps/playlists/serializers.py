from rest_framework import serializers

from apps.catalogue.models import Song

from .models import Playlist, PlaylistItem


class OwnerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()


class PlaylistSongSerializer(serializers.ModelSerializer):
    artist = OwnerSerializer(read_only=True)

    class Meta:
        model = Song
        fields = ["id", "title", "artist", "duration_seconds"]
        read_only_fields = fields


class PlaylistItemSerializer(serializers.ModelSerializer):
    """
    `is_playable` is false when the song was unpublished after it was added; the
    player skips it (UC-18 E2) and its details are hidden like in the catalogue.
    """

    song = serializers.SerializerMethodField()
    is_playable = serializers.SerializerMethodField()

    class Meta:
        model = PlaylistItem
        fields = ["id", "position", "song", "is_playable", "added_at"]
        read_only_fields = fields

    def _playable(self, item: PlaylistItem) -> bool:
        return item.song_id in self.context.get("playable_song_ids", set())

    def get_is_playable(self, item: PlaylistItem) -> bool:
        return self._playable(item)

    def get_song(self, item: PlaylistItem) -> dict | None:
        if not self._playable(item):
            return None
        return PlaylistSongSerializer(item.song).data


class PlaylistSerializer(serializers.ModelSerializer):
    owner = OwnerSerializer(read_only=True)
    item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Playlist
        fields = ["id", "name", "is_displayed", "owner", "item_count", "created_at", "updated_at"]
        read_only_fields = ["id", "owner", "item_count", "created_at", "updated_at"]


class PlaylistDetailSerializer(PlaylistSerializer):
    items = PlaylistItemSerializer(many=True, read_only=True)

    class Meta(PlaylistSerializer.Meta):
        fields = PlaylistSerializer.Meta.fields + ["items"]


class AddSongSerializer(serializers.Serializer):
    song = serializers.PrimaryKeyRelatedField(queryset=Song.objects.none())

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None:
            # Only songs the user can play may be added (catalogue visibility rule).
            self.fields["song"].queryset = Song.objects.visible_to(request.user)

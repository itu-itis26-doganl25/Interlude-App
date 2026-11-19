from django.contrib.auth import get_user_model
from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Album, Song

_UNSET = object()


def delete_files_on_commit(names, storage) -> None:
    """Remove replaced/deleted media from storage once the DB change is committed."""
    names = [n for n in names if n]
    if names:
        transaction.on_commit(lambda: [storage.delete(n) for n in names])


class ArtistSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ["id", "username"]
        read_only_fields = fields


class ReplaceFilesMixin:
    """On update, a newly uploaded file replaces the old one in storage."""

    file_fields: tuple[str, ...] = ()

    def update(self, instance, validated_data):
        replaced = [
            getattr(instance, f).name
            for f in self.file_fields
            if f in validated_data and getattr(instance, f)
        ]
        storage = instance._meta.get_field(self.file_fields[0]).storage
        instance = super().update(instance, validated_data)
        delete_files_on_commit(replaced, storage)
        return instance


class SongSerializer(ReplaceFilesMixin, serializers.ModelSerializer):
    file_fields = ("audio_file", "cover")

    artist = ArtistSerializer(read_only=True)
    album = serializers.PrimaryKeyRelatedField(
        queryset=Album.objects.all(), required=False, allow_null=True
    )
    album_title = serializers.CharField(source="album.title", read_only=True)

    class Meta:
        model = Song
        fields = [
            "id",
            "title",
            "artist",
            "album",
            "album_title",
            "track_number",
            "genre",
            "audio_file",
            "cover",
            "duration_seconds",
            "file_size",
            "mime_type",
            "rights_confirmed",
            "is_published",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["file_size", "mime_type", "created_at", "updated_at"]
        # The raw audio URL is never returned; playback goes through the
        # streaming endpoint (WBS-8.1), which issues time-limited URLs.
        extra_kwargs = {"audio_file": {"write_only": True}}
        # The conditional unique constraint is checked in validate() instead,
        # so the error message is clear.
        validators = []

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if isinstance(self.instance, Song):
            # Editing metadata must not require re-uploading the audio.
            self.fields["audio_file"].required = False

    def _value(self, attrs, name):
        """The value after this request: the new one if sent, else the stored one."""
        if name in attrs:
            return attrs[name]
        return getattr(self.instance, name) if self.instance else None

    def validate(self, attrs):
        artist = self.instance.artist if self.instance else self.context["request"].user
        album = self._value(attrs, "album")
        track_number = self._value(attrs, "track_number")
        errors = {}

        if album is not None and album.artist_id != artist.id:
            errors["album"] = "You can only add songs to your own albums."
        elif album is not None and track_number is not None:
            clash = Song.objects.filter(album=album, track_number=track_number)
            if self.instance:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                errors["track_number"] = f"Track {track_number} already exists on this album."

        if self._value(attrs, "is_published") and not self._value(attrs, "rights_confirmed"):
            errors["rights_confirmed"] = "Confirm you hold the rights before publishing."

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def update(self, instance, validated_data):
        if "audio_file" in validated_data:
            # Recomputed from the new file in Song.save()
            instance.file_size = None
            instance.mime_type = ""
        return super().update(instance, validated_data)


class AlbumSerializer(ReplaceFilesMixin, serializers.ModelSerializer):
    file_fields = ("cover",)

    artist = ArtistSerializer(read_only=True)
    song_count = serializers.SerializerMethodField()

    class Meta:
        model = Album
        fields = [
            "id",
            "title",
            "artist",
            "description",
            "cover",
            "release_date",
            "song_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    @extend_schema_field(serializers.IntegerField())
    def get_song_count(self, album) -> int:
        """Number of published songs (annotated in list/detail views)."""
        annotated = getattr(album, "song_count", _UNSET)
        if annotated is not _UNSET:
            return annotated
        return album.songs.filter(is_published=True).count()


class AlbumDetailSerializer(AlbumSerializer):
    songs = SongSerializer(many=True, read_only=True, source="visible_songs")

    class Meta(AlbumSerializer.Meta):
        fields = AlbumSerializer.Meta.fields + ["songs"]

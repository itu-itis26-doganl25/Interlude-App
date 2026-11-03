"""
Owner: Şevval. Song and album catalogue — WBS-1.4 data model.

Media files are stored through Django's default storage: local filesystem in
development, a private Azure Blob container in staging/production (WBS-6.1).
Streaming (WBS-8.1) hands out time-limited URLs to these files.
"""
import uuid
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from .validators import (
    validate_audio_extension,
    validate_audio_size,
    validate_image_extension,
    validate_image_size,
)


def _random_name(prefix: str, instance, filename: str) -> str:
    """
    Store files under an unguessable name grouped by artist, e.g.
    audio/12/3f2b...e1.mp3. The original filename is never used in the path.
    """
    ext = Path(filename).suffix.lower()
    return f"{prefix}/{instance.artist_id}/{uuid.uuid4().hex}{ext}"


def audio_upload_path(instance, filename: str) -> str:
    return _random_name("audio", instance, filename)


def cover_upload_path(instance, filename: str) -> str:
    return _random_name("covers", instance, filename)


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Album(TimeStampedModel):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="albums",
        limit_choices_to={"role": "musician"},
    )
    description = models.TextField(blank=True)
    cover = models.FileField(
        upload_to=cover_upload_path,
        blank=True,
        validators=[validate_image_extension, validate_image_size],
    )
    release_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["title"])]

    def __str__(self) -> str:
        return self.title


class Song(TimeStampedModel):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="songs",
        limit_choices_to={"role": "musician"},
    )
    album = models.ForeignKey(
        Album,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="songs",
    )
    track_number = models.PositiveSmallIntegerField(null=True, blank=True)
    genre = models.CharField(max_length=50, blank=True)

    # Media — filled in by the upload flow (WBS-6.1)
    audio_file = models.FileField(
        upload_to=audio_upload_path,
        validators=[validate_audio_extension, validate_audio_size],
    )
    cover = models.FileField(
        upload_to=cover_upload_path,
        blank=True,
        validators=[validate_image_extension, validate_image_size],
    )
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    file_size = models.PositiveBigIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=50, blank=True)

    # Musicians confirm they hold the rights (risk R-02); 
    rights_confirmed = models.BooleanField(default=False)
    # unpublished songs are hidden from search and streaming.
    is_published = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["title"]),
            models.Index(fields=["genre"]),
            models.Index(fields=["is_published", "-created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["album", "track_number"],
                condition=models.Q(album__isnull=False, track_number__isnull=False),
                name="unique_track_number_per_album",
            ),
            models.CheckConstraint(
                # Django 5.1+: `condition=`; on 5.0 or older use `check=`
                condition=models.Q(is_published=False) | models.Q(rights_confirmed=True),
                name="published_songs_have_rights_confirmed",
            ),
        ]

    def __str__(self) -> str:
        return self.title

    def clean(self) -> None:
        super().clean()
        if self.album_id and self.artist_id and self.album.artist_id != self.artist_id:
            raise ValidationError({"album": "A song can only be added to the artist's own album."})
        if self.is_published and not self.rights_confirmed:
            raise ValidationError(
                {"rights_confirmed": "Confirm you hold the rights before publishing."}
            )

    def save(self, *args, **kwargs):
        # Keep size/type metadata in sync with the uploaded file.
        if self.audio_file and not self.file_size:
            try:
                self.file_size = self.audio_file.size
            except (FileNotFoundError, ValueError):
                pass
        if self.audio_file and not self.mime_type:
            content_type = getattr(getattr(self.audio_file, "file", None), "content_type", "")
            if content_type:
                self.mime_type = content_type
        super().save(*args, **kwargs)

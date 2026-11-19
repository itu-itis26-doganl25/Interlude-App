"""
Owner: E (Efe). User playlists — WBS-8.3 (FR-47, FR-48, UC-18).

The playlist UI and player-queue integration (WBS-8.4) and profile pages
(WBS-4.2) consume these through the REST API.
"""

from django.conf import settings
from django.db import models


class Playlist(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="playlists"
    )
    name = models.CharField(max_length=100)
    # FR-48 "Show on my profile": hidden playlists are visible only to their owner.
    is_displayed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["owner", "is_displayed"])]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(name=""), name="playlists_playlist_name_not_blank"
            ),
        ]

    def __str__(self) -> str:
        return self.name


class PlaylistItem(models.Model):
    """A song at a position in a playlist. The same song may appear more than once."""

    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name="items")
    song = models.ForeignKey("catalogue.Song", on_delete=models.CASCADE, related_name="+")
    # Songs keep the order they were added in (UC-18 step 5); removing one leaves a gap.
    position = models.PositiveIntegerField()
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(
                fields=["playlist", "position"], name="playlists_unique_item_position"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.playlist_id}#{self.position}: {self.song_id}"

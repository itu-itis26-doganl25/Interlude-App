"""
Owner: D (Kağan). Listening rooms — WBS-9.1 (create, list, join, leave).

Capacity, private rooms and search (WBS-9.3), presence over WebSocket
(WBS-10.1) and synchronized playback (WBS-11.2) build on these models.
"""
from django.conf import settings
from django.db import models


class Room(models.Model):
    name = models.CharField(max_length=100)
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="hosted_rooms"
    )
    current_song = models.ForeignKey(
        "catalogue.Song", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    # Closed rooms are kept (not deleted) so listening events can still point at them.
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class RoomParticipant(models.Model):
    """A user who is currently in a room. The row is deleted when they leave."""

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="room_memberships"
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Join order decides who becomes host when the host leaves (FR-28).
        ordering = ["joined_at", "id"]
        constraints = [
            models.UniqueConstraint(fields=["room", "user"], name="rooms_unique_participant"),
        ]

    def __str__(self) -> str:
        return f"{self.user} in {self.room}"

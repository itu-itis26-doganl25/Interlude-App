"""
Owner: E/F (Efe/Taha). Minimal ListeningEvent model from the shared WBS-1.4 data
model. Collection (WBS-12.1) and aggregation (WBS-12.2) build on it.
"""
from django.conf import settings
from django.db import models


class ListeningEvent(models.Model):
    class EventType(models.TextChoices):
        PLAY = "play", "Play"
        SKIP = "skip", "Skip"
        COMPLETE = "complete", "Complete"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="listening_events",
    )
    song = models.ForeignKey(
        "catalogue.Song", on_delete=models.CASCADE, related_name="listening_events"
    )
    room = models.ForeignKey(
        "rooms.Room", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    event_type = models.CharField(max_length=16, choices=EventType.choices)
    position_seconds = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["song", "event_type", "created_at"])]

    def __str__(self) -> str:
        return f"{self.event_type} {self.song_id}"

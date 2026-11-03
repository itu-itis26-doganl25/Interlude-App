"""
Owner: D (Kağan). Minimal Room model from the shared WBS-1.4 data model.
D extends it with participants, playback state, etc. in WBS-9.1 / 11.x.
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
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name

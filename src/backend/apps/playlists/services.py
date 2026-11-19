from django.db import transaction
from django.db.models import Max

from apps.catalogue.models import Song

from .models import Playlist, PlaylistItem


def append_song(playlist: Playlist, song: Song) -> PlaylistItem:
    """Add a song at the end. The playlist row is locked so that two concurrent adds
    cannot take the same position (the unique constraint is the last line of defence)."""
    with transaction.atomic():
        Playlist.objects.select_for_update().filter(pk=playlist.pk).first()
        last = playlist.items.aggregate(last=Max("position"))["last"]
        item = PlaylistItem.objects.create(
            playlist=playlist, song=song, position=0 if last is None else last + 1
        )
        # Bump updated_at so "recently changed" ordering in the UI stays correct.
        Playlist.objects.filter(pk=playlist.pk).update(updated_at=item.added_at)
    return item

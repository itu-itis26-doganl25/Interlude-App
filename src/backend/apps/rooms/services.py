"""
Room membership rules (WBS-9.1): FR-26 create, FR-27 join, FR-28 leave.

The REST views and, later, the WebSocket consumers (WBS-10.1) both call these
functions, so the rules live in one place. Join and leave lock the room row
(select_for_update) so two people leaving at once cannot both become host.
"""
from django.db import transaction
from django.utils import timezone

from .models import Room, RoomParticipant


class RoomClosed(Exception):
    """The room has closed; nobody can join it any more."""


@transaction.atomic
def create_room(*, host, name: str) -> Room:
    """Create a room; its creator becomes host and first participant (FR-26)."""
    room = Room.objects.create(name=name, host=host)
    RoomParticipant.objects.create(room=room, user=host)
    return room


@transaction.atomic
def join_room(*, room_id: int, user) -> Room:
    """
    Add `user` to the room (FR-27). Joining a room you are already in changes
    nothing. Raises Room.DoesNotExist or RoomClosed.
    """
    room = Room.objects.select_for_update().get(pk=room_id)
    if not room.is_active:
        raise RoomClosed
    RoomParticipant.objects.get_or_create(room=room, user=user)
    return room


@transaction.atomic
def leave_room(*, room_id: int, user) -> Room:
    """
    Remove `user` from the room (FR-28). If the host leaves, the participant
    who joined earliest becomes host; when nobody is left, the room closes.
    Leaving a room you are not in changes nothing.
    """
    room = Room.objects.select_for_update().get(pk=room_id)
    RoomParticipant.objects.filter(room=room, user=user).delete()

    remaining = room.participants.select_related("user").first()
    if remaining is None:
        if room.is_active:
            _close(room)
    elif room.host_id == user.id:
        room.host = remaining.user
        room.save(update_fields=["host"])
    return room


def _close(room: Room) -> None:
    room.is_active = False
    room.closed_at = timezone.now()
    room.current_song = None
    room.save(update_fields=["is_active", "closed_at", "current_song"])

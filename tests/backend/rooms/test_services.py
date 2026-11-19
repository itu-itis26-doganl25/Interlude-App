"""
Room membership rules (WBS-9.1): FR-26 create, FR-27 join, FR-28 leave.
Written before the services (test-first); the REST API and the WebSocket
consumers (WBS-10.1) both go through these functions.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import User
from apps.catalogue.models import Song
from apps.rooms import services
from apps.rooms.models import Room, RoomParticipant

pytestmark = pytest.mark.django_db


@pytest.fixture
def friend(db):
    return User.objects.create_user("friend1", "friend1@example.com", "pw-123456!")


def usernames(room):
    return [p.user.username for p in room.participants.select_related("user")]


# --------------------------------------------------------------------------
# FR-26: create
# --------------------------------------------------------------------------
def test_creator_becomes_host_and_first_participant(listener):
    room = services.create_room(host=listener, name="Friday Night")
    assert room.host == listener
    assert room.is_active
    assert usernames(room) == ["listener1"]


# --------------------------------------------------------------------------
# FR-27: join
# --------------------------------------------------------------------------
def test_join_adds_participant(listener, musician):
    room = services.create_room(host=listener, name="Friday Night")
    services.join_room(room_id=room.id, user=musician)
    assert usernames(room) == ["listener1", "artist1"]


def test_joining_twice_does_not_duplicate(listener, musician):
    room = services.create_room(host=listener, name="Friday Night")
    services.join_room(room_id=room.id, user=musician)
    services.join_room(room_id=room.id, user=musician)
    assert RoomParticipant.objects.filter(room=room).count() == 2


def test_cannot_join_closed_room(listener, musician):
    room = services.create_room(host=listener, name="Friday Night")
    services.leave_room(room_id=room.id, user=listener)
    with pytest.raises(services.RoomClosed):
        services.join_room(room_id=room.id, user=musician)


def test_join_unknown_room_raises_not_found(musician):
    with pytest.raises(Room.DoesNotExist):
        services.join_room(room_id=999, user=musician)


# --------------------------------------------------------------------------
# FR-28: leave, host hand-over, close
# --------------------------------------------------------------------------
def test_participant_leaves_host_stays(listener, musician):
    room = services.create_room(host=listener, name="Friday Night")
    services.join_room(room_id=room.id, user=musician)
    room = services.leave_room(room_id=room.id, user=musician)
    assert room.host == listener
    assert usernames(room) == ["listener1"]


def test_host_leaving_passes_host_to_earliest_joiner(listener, musician, friend):
    room = services.create_room(host=listener, name="Friday Night")
    services.join_room(room_id=room.id, user=musician)
    services.join_room(room_id=room.id, user=friend)
    room = services.leave_room(room_id=room.id, user=listener)
    assert room.host == musician
    assert room.is_active
    assert usernames(room) == ["artist1", "friend1"]


def test_last_participant_leaving_closes_room(listener, musician):
    room = services.create_room(host=listener, name="Friday Night")
    services.join_room(room_id=room.id, user=musician)
    services.leave_room(room_id=room.id, user=listener)
    room = services.leave_room(room_id=room.id, user=musician)
    assert not room.is_active
    assert room.closed_at is not None
    assert usernames(room) == []


def test_closing_clears_current_song(listener, musician):
    song = Song.objects.create(
        artist=musician,
        title="Night Shift",
        audio_file=SimpleUploadedFile("track.mp3", b"\x00" * 1024, content_type="audio/mpeg"),
    )
    room = services.create_room(host=listener, name="Friday Night")
    Room.objects.filter(pk=room.pk).update(current_song=song)
    room = services.leave_room(room_id=room.id, user=listener)
    assert room.current_song is None


def test_leaving_a_room_you_are_not_in_changes_nothing(listener, musician):
    room = services.create_room(host=listener, name="Friday Night")
    room = services.leave_room(room_id=room.id, user=musician)
    assert room.is_active
    assert room.host == listener
    assert usernames(room) == ["listener1"]

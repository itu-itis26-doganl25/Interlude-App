"""
Room REST API tests (WBS-9.1): FR-26 create, FR-27 list and join, FR-28 leave.
Written before the views (test-first); each section names the requirement it checks.
"""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.rooms.models import Room, RoomParticipant

pytestmark = pytest.mark.django_db

ROOMS = reverse("rooms:room-list")


def detail(room_id):
    return reverse("rooms:room-detail", args=[room_id])


def join(room_id):
    return reverse("rooms:room-join", args=[room_id])


def leave(room_id):
    return reverse("rooms:room-leave", args=[room_id])


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def friend(db):
    return User.objects.create_user("friend1", "friend1@example.com", "pw-123456!")


def create_room(user, name="Friday Night"):
    response = client_for(user).post(ROOMS, {"name": name}, format="json")
    assert response.status_code == status.HTTP_201_CREATED, response.data
    return response.json()


# --------------------------------------------------------------------------
# Authentication: every room endpoint needs a logged-in user
# --------------------------------------------------------------------------
@pytest.mark.parametrize("method, url", [
    ("get", ROOMS),
    ("post", ROOMS),
    ("get", "/api/rooms/1/"),
    ("post", "/api/rooms/1/join/"),
    ("post", "/api/rooms/1/leave/"),
])
def test_anonymous_requests_are_rejected(api_client, method, url):
    response = getattr(api_client, method)(url)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


# --------------------------------------------------------------------------
# FR-26: create a room; the creator becomes host
# --------------------------------------------------------------------------
class TestCreate:
    def test_creator_is_host_and_only_participant(self, listener):
        room = create_room(listener, "  Friday Night  ")
        assert room["name"] == "Friday Night"
        assert room["host"] == {"id": listener.id, "username": "listener1"}
        assert room["participant_count"] == 1
        assert [p["user"]["username"] for p in room["participants"]] == ["listener1"]

    @pytest.mark.parametrize("name", ["", "   "])
    def test_blank_name_is_rejected(self, listener, name):
        response = client_for(listener).post(ROOMS, {"name": name}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.json()
        assert not Room.objects.exists()

    def test_too_long_name_is_rejected(self, listener):
        response = client_for(listener).post(ROOMS, {"name": "x" * 101}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.json()


# --------------------------------------------------------------------------
# FR-27: list active rooms; join a listed public room without a password
# --------------------------------------------------------------------------
class TestListAndJoin:
    def test_list_shows_name_host_count_and_track(self, listener, musician):
        room = create_room(listener)
        response = client_for(musician).get(ROOMS)
        assert response.status_code == status.HTTP_200_OK
        [entry] = response.json()["results"]
        assert entry["id"] == room["id"]
        assert entry["name"] == "Friday Night"
        assert entry["host"]["username"] == "listener1"
        assert entry["participant_count"] == 1
        assert entry["current_song"] is None

    def test_list_is_newest_first_and_hides_closed_rooms(self, listener, musician):
        older = create_room(listener, "Older")
        newer = create_room(musician, "Newer")
        closed = create_room(listener, "Closed")
        client_for(listener).post(leave(closed["id"]))
        names = [r["name"] for r in client_for(listener).get(ROOMS).json()["results"]]
        assert names == [newer["name"], older["name"]]

    def test_second_user_joins_without_password(self, listener, musician):
        room = create_room(listener)
        response = client_for(musician).post(join(room["id"]))
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["participant_count"] == 2
        assert [p["user"]["username"] for p in body["participants"]] == ["listener1", "artist1"]

    def test_joining_twice_is_harmless(self, listener, musician):
        room = create_room(listener)
        client_for(musician).post(join(room["id"]))
        response = client_for(musician).post(join(room["id"]))
        assert response.status_code == status.HTTP_200_OK
        assert RoomParticipant.objects.filter(room_id=room["id"]).count() == 2

    def test_join_unknown_room_is_not_found(self, musician):
        assert client_for(musician).post(join(999)).status_code == status.HTTP_404_NOT_FOUND

    def test_join_closed_room_says_no_longer_available(self, listener, musician):
        room = create_room(listener)
        client_for(listener).post(leave(room["id"]))
        response = client_for(musician).post(join(room["id"]))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "no longer available" in response.json()["detail"]

    def test_room_page_lists_participants_in_join_order(self, listener, musician, friend):
        room = create_room(listener)
        client_for(musician).post(join(room["id"]))
        client_for(friend).post(join(room["id"]))
        body = client_for(friend).get(detail(room["id"])).json()
        assert [p["user"]["username"] for p in body["participants"]] == [
            "listener1", "artist1", "friend1",
        ]


# --------------------------------------------------------------------------
# FR-28: leave; the host role passes on; the last one out closes the room
# --------------------------------------------------------------------------
class TestLeave:
    def test_participant_leaves(self, listener, musician):
        room = create_room(listener)
        client_for(musician).post(join(room["id"]))
        response = client_for(musician).post(leave(room["id"]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        body = client_for(listener).get(detail(room["id"])).json()
        assert body["participant_count"] == 1
        assert body["host"]["username"] == "listener1"

    def test_host_leaving_makes_earliest_joiner_host(self, listener, musician, friend):
        room = create_room(listener)
        client_for(musician).post(join(room["id"]))
        client_for(friend).post(join(room["id"]))
        client_for(listener).post(leave(room["id"]))
        body = client_for(musician).get(detail(room["id"])).json()
        assert body["host"]["username"] == "artist1"
        assert body["participant_count"] == 2

    def test_last_one_out_removes_room_from_list(self, listener, musician):
        room = create_room(listener)
        client_for(musician).post(join(room["id"]))
        client_for(listener).post(leave(room["id"]))
        client_for(musician).post(leave(room["id"]))
        assert client_for(musician).get(ROOMS).json()["results"] == []
        assert client_for(musician).get(detail(room["id"])).status_code == status.HTTP_404_NOT_FOUND

    def test_leaving_unknown_room_is_not_found(self, musician):
        assert client_for(musician).post(leave(999)).status_code == status.HTTP_404_NOT_FOUND

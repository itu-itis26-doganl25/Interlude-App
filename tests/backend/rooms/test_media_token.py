"""
Media-server access for room participants (WBS-9.1, issue #21).
Joining a room returns a short-lived signed token that the Go media server
checks before streaming room audio (FR-32). Written before the code (test-first).
"""
import time

import jwt
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

SECRET = "test-media-secret-that-is-long-enough-for-hs256"
ROOMS = reverse("rooms:room-list")


@pytest.fixture(autouse=True)
def media_server(settings):
    settings.MEDIA_SERVER_URL = "http://media.example:8080"
    settings.MEDIA_SERVER_SECRET = SECRET
    settings.MEDIA_TOKEN_TTL_SECONDS = 120


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def create_room(user):
    return client_for(user).post(ROOMS, {"name": "Friday Night"}, format="json").json()


def decode(token):
    return jwt.decode(token, SECRET, algorithms=["HS256"], audience="interlude-media")


# --------------------------------------------------------------------------
# Joining hands out media access
# --------------------------------------------------------------------------
def test_join_returns_media_url_and_token(listener, musician):
    room = create_room(listener)
    response = client_for(musician).post(reverse("rooms:room-join", args=[room["id"]]))
    media = response.json()["media"]
    assert media["url"] == "http://media.example:8080"
    claims = decode(media["token"])
    assert claims["sub"] == str(musician.id)
    assert claims["name"] == "artist1"
    assert claims["room"] == room["id"]


def test_creating_a_room_also_returns_media_access(listener):
    room = create_room(listener)
    assert decode(room["media"]["token"])["room"] == room["id"]


def test_token_expires_after_ttl(listener):
    before = int(time.time())
    claims = decode(create_room(listener)["media"]["token"])
    assert before + 120 <= claims["exp"] <= int(time.time()) + 120


def test_token_cannot_be_used_as_a_login_token(listener):
    token = create_room(listener)["media"]["token"]
    with pytest.raises(jwt.InvalidAudienceError):
        jwt.decode(token, SECRET, algorithms=["HS256"], audience="something-else")


def test_media_is_null_when_no_media_server_is_configured(settings, listener):
    settings.MEDIA_SERVER_SECRET = ""
    assert create_room(listener)["media"] is None


# --------------------------------------------------------------------------
# Fresh token for reconnecting (NFR-13)
# --------------------------------------------------------------------------
def test_participant_gets_fresh_token(listener):
    room = create_room(listener)
    response = client_for(listener).post(reverse("rooms:room-media-token", args=[room["id"]]))
    assert response.status_code == status.HTTP_200_OK
    assert decode(response.json()["token"])["room"] == room["id"]


def test_non_participant_gets_no_token(listener, musician):
    room = create_room(listener)
    response = client_for(musician).post(reverse("rooms:room-media-token", args=[room["id"]]))
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_no_token_for_closed_room(listener):
    room = create_room(listener)
    client_for(listener).post(reverse("rooms:room-leave", args=[room["id"]]))
    response = client_for(listener).post(reverse("rooms:room-media-token", args=[room["id"]]))
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_fresh_token_unavailable_without_media_server(settings, listener):
    room = create_room(listener)
    settings.MEDIA_SERVER_SECRET = ""
    response = client_for(listener).post(reverse("rooms:room-media-token", args=[room["id"]]))
    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

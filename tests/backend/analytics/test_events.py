"""WBS-12.1 / FR-35 / UC-15: recording listening events."""

import uuid

import pytest

from apps.analytics.models import ListeningEvent
from apps.rooms.models import Room

pytestmark = pytest.mark.django_db
URL = "/api/analytics/events/"


def payload(song, event_type="play", **extra):
    return {
        "client_event_id": str(uuid.uuid4()),
        "song": song.id,
        "event_type": event_type,
        **extra,
    }


@pytest.mark.parametrize("event_type", ["play", "skip", "complete"])
def test_each_playback_action_creates_one_event(
    api_client, listener, musician, make_song, event_type
):
    song = make_song(musician)
    api_client.force_authenticate(listener)

    response = api_client.post(URL, payload(song, event_type, position_seconds=42), format="json")

    assert response.status_code == 201
    event = ListeningEvent.objects.get()
    assert (event.song, event.user, event.event_type) == (song, listener, event_type)
    assert event.position_seconds == 42
    assert event.created_at is not None
    assert response.data["context"] == "individual"


def test_room_event_stores_room_context(api_client, listener, musician, make_song):
    song = make_song(musician)
    room = Room.objects.create(name="Night", host=musician)
    api_client.force_authenticate(listener)

    response = api_client.post(URL, payload(song, room=room.id), format="json")

    assert response.status_code == 201
    assert response.data["context"] == "room"
    assert ListeningEvent.objects.get().room == room


def test_response_does_not_expose_listener(api_client, listener, musician, make_song):
    api_client.force_authenticate(listener)
    response = api_client.post(URL, payload(make_song(musician)), format="json")
    assert "user" not in response.data


def test_retried_event_is_stored_once(api_client, listener, musician, make_song):
    body = payload(make_song(musician))
    api_client.force_authenticate(listener)

    first = api_client.post(URL, body, format="json")
    retry = api_client.post(URL, body, format="json")

    assert (first.status_code, retry.status_code) == (201, 200)
    assert retry.data["id"] == first.data["id"]
    assert ListeningEvent.objects.count() == 1


def test_same_client_id_from_different_users_is_not_deduplicated(
    api_client, listener, musician, make_song
):
    body = payload(make_song(musician))
    for user in (listener, musician):
        api_client.force_authenticate(user)
        assert api_client.post(URL, body, format="json").status_code == 201
    assert ListeningEvent.objects.count() == 2


def test_unauthenticated_client_is_rejected(api_client, musician, make_song):
    response = api_client.post(URL, payload(make_song(musician)), format="json")
    assert response.status_code == 401
    assert not ListeningEvent.objects.exists()


@pytest.mark.parametrize(
    "change",
    [
        {"song": 999_999},  # non-existent track (UC-15 E1)
        {"event_type": "pause"},
        {"client_event_id": None},
        {"client_event_id": "not-a-uuid"},
        {"room": 999_999},
        {"position_seconds": -1},
    ],
)
def test_invalid_events_are_rejected(api_client, listener, musician, make_song, change):
    api_client.force_authenticate(listener)
    body = {**payload(make_song(musician)), **change}
    response = api_client.post(URL, body, format="json")
    assert response.status_code == 400
    assert not ListeningEvent.objects.exists()


def test_someone_elses_unpublished_song_is_rejected(api_client, listener, musician, make_song):
    api_client.force_authenticate(listener)
    response = api_client.post(URL, payload(make_song(musician, published=False)), format="json")
    assert response.status_code == 400


def test_musician_can_record_plays_of_own_draft(api_client, musician, make_song):
    """Same visibility rule as the catalogue: the artist can play their own drafts."""
    api_client.force_authenticate(musician)
    response = api_client.post(URL, payload(make_song(musician, published=False)), format="json")
    assert response.status_code == 201


def test_closed_room_is_accepted_for_delayed_events(api_client, listener, musician, make_song):
    """Events may arrive after the room closed (offline sync); rooms are kept for this."""
    room = Room.objects.create(name="Closed", host=musician, is_active=False)
    api_client.force_authenticate(listener)
    response = api_client.post(URL, payload(make_song(musician), room=room.id), format="json")
    assert response.status_code == 201
    assert response.data["context"] == "room"


def test_position_beyond_track_end_is_rejected(api_client, listener, musician, make_song):
    song = make_song(musician, duration=180)
    api_client.force_authenticate(listener)
    response = api_client.post(URL, payload(song, position_seconds=181), format="json")
    assert response.status_code == 400
    assert "position_seconds" in response.data


def test_event_spam_is_throttled(api_client, listener, musician, make_song, monkeypatch):
    from apps.analytics.views import ListeningEventThrottle

    monkeypatch.setattr(ListeningEventThrottle, "rate", "2/min")
    song = make_song(musician)
    api_client.force_authenticate(listener)

    codes = [api_client.post(URL, payload(song), format="json").status_code for _ in range(3)]

    assert codes == [201, 201, 429]


def test_concurrent_retry_returns_stored_event(
    api_client, listener, musician, make_song, monkeypatch
):
    """Two requests pass the duplicate check at once; the DB constraint decides."""
    body = payload(make_song(musician))
    stored = ListeningEvent.objects.create(
        user=listener,
        song_id=body["song"],
        event_type="play",
        client_event_id=body["client_event_id"],
    )
    real_filter = ListeningEvent.objects.filter
    monkeypatch.setattr(ListeningEvent.objects, "filter", lambda *a, **kw: real_filter(pk__in=[]))
    api_client.force_authenticate(listener)

    response = api_client.post(URL, body, format="json")

    assert response.status_code == 200
    assert response.data["id"] == stored.id
    assert ListeningEvent.objects.count() == 1

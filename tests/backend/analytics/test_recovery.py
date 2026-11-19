"""
WBS-12.3 / FR-53: recovery log for resuming playback.
Acceptance: after a simulated disconnection the player can resume the same track at
the saved position. There is no offline playback; events that could not be sent
during a disconnect are retried through POST events/ (idempotent, see test_events).
"""

import uuid

import pytest
from django.urls import reverse

from apps.analytics.models import ListeningEvent, PlaybackState

pytestmark = pytest.mark.django_db

EVENTS = reverse("analytics:event-create")
STATE = reverse("analytics:playback-state")

# --- Recovery log -----------------------------------------------------------------


def test_nothing_to_resume_returns_204(api_client, listener):
    api_client.force_authenticate(listener)
    assert api_client.get(STATE).status_code == 204


def test_player_can_resume_saved_position(api_client, listener, musician, make_song):
    song = make_song(musician, duration=200)
    api_client.force_authenticate(listener)
    api_client.put(STATE, {"song": song.id, "position_seconds": 30}, format="json")
    api_client.put(STATE, {"song": song.id, "position_seconds": 95}, format="json")

    response = api_client.get(STATE)  # after the simulated disconnect

    assert response.status_code == 200
    assert (response.data["song"], response.data["position_seconds"]) == (song.id, 95)
    assert PlaybackState.objects.count() == 1


def test_recovery_log_is_per_user(api_client, listener, musician, make_song):
    song = make_song(musician)
    api_client.force_authenticate(listener)
    api_client.put(STATE, {"song": song.id, "position_seconds": 10}, format="json")
    api_client.force_authenticate(musician)

    assert api_client.get(STATE).status_code == 204


def test_unplayable_song_is_not_offered_for_resume(api_client, listener, musician, make_song):
    song = make_song(musician)
    api_client.force_authenticate(listener)
    api_client.put(STATE, {"song": song.id, "position_seconds": 10}, format="json")
    song.is_published = False
    song.save()

    assert api_client.get(STATE).status_code == 204


@pytest.mark.parametrize("change", [{"position_seconds": 201}, {"song": 999_999}])
def test_invalid_recovery_entry_is_rejected(api_client, listener, musician, make_song, change):
    song = make_song(musician, duration=200)
    api_client.force_authenticate(listener)

    response = api_client.put(STATE, {"song": song.id, **change}, format="json")

    assert response.status_code == 400
    assert not PlaybackState.objects.exists()


def test_recovery_log_can_be_cleared(api_client, listener, musician, make_song):
    api_client.force_authenticate(listener)
    api_client.put(STATE, {"song": make_song(musician).id}, format="json")

    assert api_client.delete(STATE).status_code == 204
    assert api_client.get(STATE).status_code == 204


def test_recovery_log_requires_login(api_client):
    assert api_client.get(STATE).status_code == 401


# --- Abuse protection (security review) ---------------------------------------------


def test_recovery_response_does_not_identify_the_user(api_client, listener, musician, make_song):
    api_client.force_authenticate(listener)
    api_client.put(STATE, {"song": make_song(musician).id}, format="json")

    data = api_client.get(STATE).data

    assert set(data) == {"song", "position_seconds", "room", "updated_at"}


# --- Events retried after a disconnect ----------------------------------------------


def test_event_resent_after_a_lost_response_is_stored_once(
    api_client, listener, musician, make_song
):
    song = make_song(musician)
    payload = {"client_event_id": str(uuid.uuid4()), "song": song.id, "event_type": "play"}
    api_client.force_authenticate(listener)

    first = api_client.post(EVENTS, payload, format="json")
    retry = api_client.post(EVENTS, payload, format="json")

    assert (first.status_code, retry.status_code) == (201, 200)
    assert ListeningEvent.objects.count() == 1

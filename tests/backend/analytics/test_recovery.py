"""
WBS-12.3 / FR-53: recovery log and offline event sync.
Acceptance: after a simulated disconnection the player can resume the same track at
the saved position, and events created offline are recorded once after reconnection.
"""

import uuid
from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.analytics.models import ListeningEvent, PlaybackState

pytestmark = pytest.mark.django_db

EVENTS = reverse("analytics:event-create")
BATCH = reverse("analytics:event-batch")
STATE = reverse("analytics:playback-state")
DASHBOARD = reverse("analytics:dashboard")


def event(song, event_type="play", **extra):
    return {
        "client_event_id": str(uuid.uuid4()),
        "song": song.id,
        "event_type": event_type,
        **extra,
    }


# --- Offline events keep the time they happened ------------------------------------


def test_offline_event_is_stored_at_the_time_it_happened(api_client, listener, make_song):
    when = timezone.now() - timedelta(hours=5)
    api_client.force_authenticate(listener)

    body = event(make_song(listener), occurred_at=when.isoformat())
    response = api_client.post(EVENTS, body, format="json")

    assert response.status_code == 201
    assert ListeningEvent.objects.get().created_at == when
    assert "occurred_at" not in response.data


@pytest.mark.parametrize(
    "offset", [timedelta(minutes=10), -timedelta(days=8)], ids=["future", "too-old"]
)
def test_implausible_event_time_is_rejected(api_client, listener, make_song, offset):
    api_client.force_authenticate(listener)
    body = event(make_song(listener), occurred_at=(timezone.now() + offset).isoformat())

    response = api_client.post(EVENTS, body, format="json")

    assert response.status_code == 400
    assert "occurred_at" in response.data


def test_offline_plays_count_on_the_day_they_happened(api_client, musician, listener, make_song):
    song = make_song(musician)
    yesterday = timezone.localtime() - timedelta(days=1)
    api_client.force_authenticate(listener)
    api_client.post(
        BATCH, {"events": [event(song, occurred_at=yesterday.isoformat())]}, format="json"
    )
    api_client.force_authenticate(musician)

    series = api_client.get(DASHBOARD).json()["plays_over_time"]

    assert {p["period"]: p["plays"] for p in series}[str(yesterday.date())] == 1


# --- Batch upload of the offline queue ------------------------------------------


def test_batch_reports_each_event(api_client, listener, musician, make_song):
    song = make_song(musician)
    stored = event(song)
    api_client.force_authenticate(listener)
    api_client.post(EVENTS, stored, format="json")
    fresh = event(song, "complete")
    bad = event(song, "pause")

    response = api_client.post(BATCH, {"events": [stored, fresh, bad]}, format="json")

    assert response.status_code == 200
    assert [r["status"] for r in response.data["results"]] == ["duplicate", "created", "rejected"]
    assert [r["client_event_id"] for r in response.data["results"]] == [
        stored["client_event_id"],
        fresh["client_event_id"],
        bad["client_event_id"],
    ]
    assert "event_type" in response.data["results"][2]["errors"]
    assert ListeningEvent.objects.count() == 2


def test_resending_a_batch_records_each_event_once(api_client, listener, musician, make_song):
    song = make_song(musician)
    body = {"events": [event(song), event(song, "skip"), event(song, "complete")]}
    api_client.force_authenticate(listener)

    first = api_client.post(BATCH, body, format="json")
    again = api_client.post(BATCH, body, format="json")  # connection dropped mid-response

    assert {r["status"] for r in first.data["results"]} == {"created"}
    assert {r["status"] for r in again.data["results"]} == {"duplicate"}
    assert ListeningEvent.objects.count() == 3


def test_duplicate_inside_one_batch_is_stored_once(api_client, listener, musician, make_song):
    item = event(make_song(musician))
    api_client.force_authenticate(listener)

    response = api_client.post(BATCH, {"events": [item, item]}, format="json")

    assert [r["status"] for r in response.data["results"]] == ["created", "duplicate"]
    assert ListeningEvent.objects.count() == 1


@pytest.mark.parametrize(
    "body",
    [{"events": []}, {"events": "nope"}, {"events": [1, 2]}, {}],
    ids=["empty", "not-a-list", "not-objects", "missing"],
)
def test_malformed_batch_is_rejected(api_client, listener, body):
    api_client.force_authenticate(listener)
    assert api_client.post(BATCH, body, format="json").status_code == 400


def test_batch_size_is_limited(api_client, listener, musician, make_song):
    song = make_song(musician)
    api_client.force_authenticate(listener)
    body = {"events": [event(song) for _ in range(101)]}

    assert api_client.post(BATCH, body, format="json").status_code == 400
    assert not ListeningEvent.objects.exists()


def test_batch_requires_login(api_client, musician, make_song):
    response = api_client.post(BATCH, {"events": [event(make_song(musician))]}, format="json")
    assert response.status_code == 401


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


def test_batches_and_single_events_share_one_event_budget(
    api_client, listener, musician, make_song, monkeypatch
):
    """Batching must not multiply the per-user event limit."""
    from apps.analytics.views import ListeningEventThrottle

    monkeypatch.setattr(ListeningEventThrottle, "rate", "5/min")
    songs = [make_song(musician, f"S{i}") for i in range(7)]
    api_client.force_authenticate(listener)

    first = api_client.post(BATCH, {"events": [event(s) for s in songs[:4]]}, format="json")
    too_many = api_client.post(BATCH, {"events": [event(s) for s in songs[4:6]]}, format="json")
    single = api_client.post(EVENTS, event(songs[6]), format="json")
    last_slot = api_client.post(EVENTS, event(songs[6]), format="json")

    assert (first.status_code, too_many.status_code) == (200, 429)
    assert (single.status_code, last_slot.status_code) == (201, 429)
    assert ListeningEvent.objects.count() == 5


def test_server_keeps_its_own_receive_time(api_client, listener, musician, make_song):
    when = timezone.now() - timedelta(days=2)
    api_client.force_authenticate(listener)

    api_client.post(EVENTS, event(make_song(musician), occurred_at=when.isoformat()), format="json")

    stored = ListeningEvent.objects.get()
    assert stored.created_at == when
    assert timezone.now() - stored.received_at < timedelta(minutes=1)


def test_plays_of_one_track_are_capped_per_hour(
    api_client, listener, musician, make_song, monkeypatch
):
    from apps.analytics import recording

    monkeypatch.setattr(recording, "PLAYS_PER_TRACK_PER_HOUR", 2)
    song, other = make_song(musician, "A"), make_song(musician, "B")
    api_client.force_authenticate(listener)
    accepted = [api_client.post(EVENTS, event(song), format="json") for _ in range(2)]

    over = api_client.post(EVENTS, event(song), format="json")
    stored_id = str(accepted[0].data["client_event_id"])
    retry = api_client.post(EVENTS, {**event(song), "client_event_id": stored_id}, format="json")
    skip = api_client.post(EVENTS, event(song, "skip"), format="json")
    other_track = api_client.post(EVENTS, event(other), format="json")

    assert over.status_code == 400 and "event_type" in over.data
    assert retry.status_code == 200  # a retry of a stored play is not a new play
    assert (skip.status_code, other_track.status_code) == (201, 201)


def test_back_dated_plays_cannot_bypass_the_cap(
    api_client, listener, musician, make_song, monkeypatch
):
    """The cap counts plays the server received in the last hour, whatever time the
    client claims, so spreading occurred_at over past hours does not help."""
    from apps.analytics import recording

    monkeypatch.setattr(recording, "PLAYS_PER_TRACK_PER_HOUR", 2)
    song = make_song(musician)
    api_client.force_authenticate(listener)
    for _ in range(2):
        assert api_client.post(EVENTS, event(song), format="json").status_code == 201

    two_hours_ago = (timezone.now() - timedelta(hours=2)).isoformat()
    response = api_client.post(EVENTS, event(song, occurred_at=two_hours_ago), format="json")

    assert response.status_code == 400
    batch = api_client.post(
        BATCH, {"events": [event(song, occurred_at=two_hours_ago)]}, format="json"
    )
    assert batch.data["results"][0]["status"] == "rejected"


@pytest.mark.django_db(transaction=True)
def test_concurrent_plays_cannot_exceed_the_cap(listener, musician, make_song, monkeypatch):
    """Count-then-insert runs under a per-user row lock (needs a real concurrent DB)."""
    import threading

    from django.db import connection

    from apps.analytics import recording

    if connection.vendor != "postgresql":
        pytest.skip("SQLite serializes writes; run against PostgreSQL to test locking")
    monkeypatch.setattr(recording, "PLAYS_PER_TRACK_PER_HOUR", 3)
    song = make_song(musician)
    barrier = threading.Barrier(8)
    outcomes: list[str] = []

    def play():
        barrier.wait()
        try:
            data = {"client_event_id": uuid.uuid4(), "song": song, "event_type": "play"}
            recording.record_event(listener, data)
            outcomes.append("stored")
        except recording.PlayLimitReached:
            outcomes.append("limited")
        finally:
            connection.close()

    threads = [threading.Thread(target=play) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert outcomes.count("stored") == 3
    assert ListeningEvent.objects.filter(event_type="play").count() == 3


def test_event_endpoints_accept_json_only(api_client, listener, musician, make_song):
    """Form/multipart bodies were charged as a single event by the throttle."""
    song = make_song(musician)
    api_client.force_authenticate(listener)

    form = api_client.post(BATCH, {"events": str(song.id)})  # multipart by default
    single = api_client.post(EVENTS, {"song": song.id, "event_type": "play"})

    assert (form.status_code, single.status_code) == (415, 415)
    assert not ListeningEvent.objects.exists()


def test_malformed_batch_is_charged_the_maximum(
    api_client, listener, musician, make_song, monkeypatch
):
    from apps.analytics.views import ListeningEventThrottle

    monkeypatch.setattr(ListeningEventThrottle, "rate", "100/min")
    api_client.force_authenticate(listener)

    bad = api_client.post(BATCH, {"events": "not-a-list"}, format="json")
    after = api_client.post(EVENTS, event(make_song(musician)), format="json")

    assert (bad.status_code, after.status_code) == (400, 429)

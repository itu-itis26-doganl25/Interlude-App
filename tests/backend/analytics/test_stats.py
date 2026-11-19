"""WBS-12.2 / FR-36, FR-38, FR-39 / UC-16: aggregated musician statistics."""

import json
from datetime import date, timedelta

import pytest
from django.utils import timezone

from apps.analytics.models import ListeningEvent
from apps.catalogue.models import Song

pytestmark = pytest.mark.django_db
DASHBOARD = "/api/analytics/dashboard/"
SKIP = ListeningEvent.EventType.SKIP
COMPLETE = ListeningEvent.EventType.COMPLETE

D1, D2, D3 = date(2026, 11, 2), date(2026, 11, 3), date(2026, 11, 4)
RANGE = {"start": "2026-11-01", "end": "2026-11-07"}


def song_url(song_id: int) -> str:
    return f"/api/analytics/songs/{song_id}/"


@pytest.fixture
def catalogue(musician, other_musician, listener, make_song, make_event):
    """Known dataset: A=3 plays, B=1 play, C=0 plays; plus noise that must not count."""
    a = make_song(musician, "Alpha")
    b = make_song(musician, "Beta")
    c = make_song(musician, "Gamma")
    foreign = make_song(other_musician, "Foreign")

    for day in (D1, D1, D3):
        make_event(a, listener, on=day)
    make_event(a, listener, SKIP, on=D1)
    make_event(a, listener, COMPLETE, on=D3)
    make_event(b, listener, on=D2)
    make_event(b, listener, SKIP, on=D2)
    make_event(foreign, listener, on=D1)  # other musician's track
    make_event(a, listener, on=date(2026, 10, 15))  # outside range
    return {"a": a, "b": b, "c": c, "foreign": foreign}


def test_dashboard_counts_and_ranking_match_known_dataset(api_client, musician, catalogue):
    api_client.force_authenticate(musician)

    data = api_client.get(DASHBOARD, RANGE).json()

    assert data["range"] == {**RANGE, "interval": "day"}
    assert data["total_plays"] == 4
    assert [(t["title"], t["plays"], t["skips"], t["completions"]) for t in data["tracks"]] == [
        ("Alpha", 3, 1, 1),
        ("Beta", 1, 1, 0),
        ("Gamma", 0, 0, 0),
    ]
    assert [t["title"] for t in data["top_tracks"]] == ["Alpha", "Beta"]


def test_plays_over_time_is_continuous_per_day(api_client, musician, catalogue):
    api_client.force_authenticate(musician)

    series = api_client.get(DASHBOARD, RANGE).json()["plays_over_time"]

    assert [p["period"] for p in series] == [
        str(date(2026, 11, 1) + timedelta(days=i)) for i in range(7)
    ]
    assert [p["plays"] for p in series] == [0, 2, 1, 1, 0, 0, 0]


def test_plays_over_time_by_week_and_month(api_client, musician, catalogue):
    api_client.force_authenticate(musician)
    wide = {"start": "2026-10-01", "end": "2026-11-07"}

    weeks = api_client.get(DASHBOARD, {**wide, "interval": "week"}).json()["plays_over_time"]
    months = api_client.get(DASHBOARD, {**wide, "interval": "month"}).json()["plays_over_time"]

    assert weeks[0]["period"] == "2026-09-28"  # Monday of the week containing Oct 1
    assert {p["period"]: p["plays"] for p in weeks}["2026-11-02"] == 4
    assert sum(p["plays"] for p in weeks) == 5
    assert months == [{"period": "2026-10-01", "plays": 1}, {"period": "2026-11-01", "plays": 4}]


def test_time_range_filters_every_figure(api_client, musician, catalogue):
    api_client.force_authenticate(musician)

    data = api_client.get(DASHBOARD, {"start": "2026-11-03", "end": "2026-11-03"}).json()

    assert data["total_plays"] == 1
    assert [(t["title"], t["plays"]) for t in data["tracks"]][:1] == [("Beta", 1)]
    assert data["plays_over_time"] == [{"period": "2026-11-03", "plays": 1}]


def test_default_range_is_last_30_days(api_client, musician):
    api_client.force_authenticate(musician)
    today = timezone.localdate()

    data = api_client.get(DASHBOARD).json()

    assert data["range"]["end"] == str(today)
    assert data["range"]["start"] == str(today - timedelta(days=29))
    assert len(data["plays_over_time"]) == 30


def test_musician_without_plays_gets_empty_statistics(api_client, musician):
    api_client.force_authenticate(musician)

    data = api_client.get(DASHBOARD, RANGE).json()

    assert data["total_plays"] == 0
    assert data["tracks"] == data["top_tracks"] == []
    assert all(p["plays"] == 0 for p in data["plays_over_time"])


@pytest.mark.parametrize(
    "params",
    [
        {"start": "2026-11-07", "end": "2026-11-01"},
        {"start": "2024-01-01", "end": "2026-11-01"},
        {"start": "yesterday"},
        {"interval": "hour"},
    ],
)
def test_invalid_query_is_rejected(api_client, musician, params):
    api_client.force_authenticate(musician)
    assert api_client.get(DASHBOARD, params).status_code == 400


def test_listener_cannot_open_dashboard(api_client, listener):
    api_client.force_authenticate(listener)
    assert api_client.get(DASHBOARD).status_code == 403


def test_anonymous_cannot_open_dashboard(api_client):
    assert api_client.get(DASHBOARD).status_code == 401


def test_responses_contain_no_listener_identifiers(api_client, musician, listener, catalogue):
    api_client.force_authenticate(musician)

    bodies = [
        api_client.get(DASHBOARD, RANGE).content.decode(),
        api_client.get(song_url(catalogue["a"].id), RANGE).content.decode(),
    ]

    for body in bodies:
        assert listener.username not in body
        assert listener.email not in body
        assert '"user' not in body and "listener" not in body
        json.loads(body)  # still a well-formed aggregate document


def test_song_stats_for_own_track(api_client, musician, catalogue):
    api_client.force_authenticate(musician)

    data = api_client.get(song_url(catalogue["a"].id), RANGE).json()

    assert data["track"] == {
        "song_id": catalogue["a"].id,
        "title": "Alpha",
        "plays": 3,
        "skips": 1,
        "completions": 1,
    }
    assert sum(p["plays"] for p in data["plays_over_time"]) == 3


def test_musician_cannot_read_another_musicians_track(api_client, musician, catalogue):
    api_client.force_authenticate(musician)
    response = api_client.get(song_url(catalogue["foreign"].id), RANGE)
    assert response.status_code == 403
    assert "plays" not in response.json()


def test_listener_cannot_read_track_stats(api_client, listener, catalogue):
    api_client.force_authenticate(listener)
    assert api_client.get(song_url(catalogue["a"].id)).status_code == 403


def test_unknown_track_returns_404(api_client, musician):
    api_client.force_authenticate(musician)
    assert not Song.objects.filter(pk=999_999).exists()
    assert api_client.get(song_url(999_999)).status_code == 404


def test_days_are_bucketed_in_local_time(api_client, musician, listener, make_song, make_event):
    """00:30 in Istanbul is still the previous day in UTC; it must count as the local day."""
    from datetime import datetime, time

    song = make_song(musician)
    tz = timezone.get_current_timezone()
    for local in (
        datetime.combine(D2, time(23, 30), tzinfo=tz),  # last minutes of Nov 3
        datetime.combine(D3, time(0, 30), tzinfo=tz),  # first minutes of Nov 4
    ):
        event = make_event(song, listener)
        ListeningEvent.objects.filter(pk=event.pk).update(created_at=local)
    api_client.force_authenticate(musician)

    data = api_client.get(DASHBOARD, {"start": "2026-11-03", "end": "2026-11-04"}).json()

    assert data["plays_over_time"] == [
        {"period": "2026-11-03", "plays": 1},
        {"period": "2026-11-04", "plays": 1},
    ]
    assert data["total_plays"] == 2

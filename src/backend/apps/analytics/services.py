"""
Aggregation of listening events into musician statistics (FR-36, FR-37, FR-38).

Everything returned here is an aggregate: no function exposes which user listened
(NFR-18, FR-39). Callers are responsible for restricting `songs` to the requesting
musician's own tracks.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from enum import Enum

from django.db.models import Count, DateField, Q, QuerySet
from django.db.models.functions import Trunc
from django.utils import timezone

from apps.catalogue.models import Song

from .models import ListeningEvent

EventType = ListeningEvent.EventType
TOP_TRACKS_LIMIT = 5


class Interval(str, Enum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


@dataclass(frozen=True)
class TrackStats:
    song_id: int
    title: str
    plays: int
    skips: int
    completions: int


def _bounds(start: date, end: date) -> tuple[datetime, datetime]:
    """Inclusive local dates -> half-open aware datetime range [start, end + 1 day)."""
    tz = timezone.get_current_timezone()
    return (
        datetime.combine(start, time.min, tzinfo=tz),
        datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz),
    )


def events_between(start: date, end: date) -> QuerySet[ListeningEvent]:
    lower, upper = _bounds(start, end)
    return ListeningEvent.objects.filter(created_at__gte=lower, created_at__lt=upper)


def track_stats(songs: QuerySet[Song], start: date, end: date) -> list[TrackStats]:
    """Per-track counts for every given song (zero rows included), most played first."""
    lower, upper = _bounds(start, end)
    in_range = Q(listening_events__created_at__gte=lower, listening_events__created_at__lt=upper)

    def count(event_type: str) -> Count:
        return Count(
            "listening_events", filter=in_range & Q(listening_events__event_type=event_type)
        )

    rows = (
        songs.annotate(
            plays=count(EventType.PLAY),
            skips=count(EventType.SKIP),
            completions=count(EventType.COMPLETE),
        )
        .order_by("-plays", "title", "id")
        .values_list("id", "title", "plays", "skips", "completions")
    )
    return [TrackStats(*row) for row in rows]


def top_tracks(stats: list[TrackStats], limit: int = TOP_TRACKS_LIMIT) -> list[TrackStats]:
    """Ranking of the most played tracks; tracks without plays are not ranked."""
    return [s for s in stats if s.plays > 0][:limit]


def _bucket_start(day: date, interval: Interval) -> date:
    if interval is Interval.WEEK:
        return day - timedelta(days=day.weekday())  # ISO weeks start on Monday
    if interval is Interval.MONTH:
        return day.replace(day=1)
    return day


def _next_bucket(bucket: date, interval: Interval) -> date:
    if interval is Interval.WEEK:
        return bucket + timedelta(weeks=1)
    if interval is Interval.MONTH:
        return (bucket.replace(day=28) + timedelta(days=4)).replace(day=1)
    return bucket + timedelta(days=1)


def plays_over_time(
    songs: QuerySet[Song], start: date, end: date, interval: Interval
) -> list[dict[str, date | int]]:
    """Play counts per period, with empty periods filled in so charts stay continuous."""
    counts = dict(
        events_between(start, end)
        .filter(song__in=songs, event_type=EventType.PLAY)
        .annotate(
            period=Trunc(
                "created_at",
                interval.value,
                output_field=DateField(),
                tzinfo=timezone.get_current_timezone(),
            )
        )
        .values("period")
        .annotate(plays=Count("id"))
        .values_list("period", "plays")
    )

    series: list[dict[str, date | int]] = []
    bucket = _bucket_start(start, interval)
    while bucket <= end:
        series.append({"period": bucket, "plays": counts.get(bucket, 0)})
        bucket = _next_bucket(bucket, interval)
    return series

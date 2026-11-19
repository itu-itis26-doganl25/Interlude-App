from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.catalogue.models import Song

from . import services
from .models import PlaybackState
from .permissions import IsMusician
from .recording import PlayLimitReached, record_event
from .serializers import (
    MAX_BATCH_SIZE,
    DashboardSerializer,
    EventBatchResponseSerializer,
    EventBatchSerializer,
    ListeningEventSerializer,
    PlaybackStateSerializer,
    SongStatsSerializer,
    StatsQuerySerializer,
)

PLAY_LIMIT_ERROR = {"event_type": ["Play limit for this track reached; try again later."]}


def _event_count(request: Request, view) -> int:
    """
    Events a request carries: 1 for a single event, the list size for a batch. The
    event views accept JSON only, so this sees the same data their serializers do;
    a batch without a usable `events` list is charged the maximum.
    """
    if not isinstance(view, ListeningEventBatchView):
        return 1
    events = request.data.get("events") if isinstance(request.data, dict) else None
    if not isinstance(events, list):
        return MAX_BATCH_SIZE
    return max(1, min(len(events), MAX_BATCH_SIZE))


class ListeningEventThrottle(UserRateThrottle):
    """
    Per-user budget of *events* (not requests) shared by the single and batch
    endpoints, so batching cannot be used to inflate play counts. 120 events/min is
    generous for real playback and still lets a full offline batch (100) through.
    """

    scope = "listening_events"
    rate = "120/min"

    def allow_request(self, request, view) -> bool:
        if self.rate is None:
            return True
        self.key = self.get_cache_key(request, view)
        if self.key is None:
            return True
        self.history = self.cache.get(self.key, [])
        self.now = self.timer()
        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()
        cost = _event_count(request, view)
        if len(self.history) + cost > self.num_requests:
            return self.throttle_failure()
        self.history[:0] = [self.now] * cost
        self.cache.set(self.key, self.history, self.duration)
        return True


class ListeningEventCreateView(APIView):
    """UC-15: players report play start, skip and completion events."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ListeningEventThrottle]
    parser_classes = [JSONParser]

    @extend_schema(
        request=ListeningEventSerializer,
        responses={
            201: ListeningEventSerializer,
            200: OpenApiResponse(
                ListeningEventSerializer, description="Retried event; already stored."
            ),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = ListeningEventSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            event, created = record_event(request.user, serializer.validated_data)
        except PlayLimitReached:
            return Response(PLAY_LIMIT_ERROR, status=status.HTTP_400_BAD_REQUEST)
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(ListeningEventSerializer(event).data, status=code)


class ListeningEventBatchView(APIView):
    """
    FR-53: events buffered while offline are uploaded together on reconnection.
    Each item is validated and stored on its own, so one bad event cannot block the
    queue; the per-item status tells the client what to drop from its buffer.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ListeningEventThrottle]
    parser_classes = [JSONParser]

    @extend_schema(request=EventBatchSerializer, responses=EventBatchResponseSerializer)
    def post(self, request: Request) -> Response:
        batch = EventBatchSerializer(data=request.data)
        batch.is_valid(raise_exception=True)

        results = []
        for raw in batch.validated_data["events"]:
            raw_id = raw.get("client_event_id")
            result = {"client_event_id": None if raw_id is None else str(raw_id)}
            serializer = ListeningEventSerializer(data=raw, context={"request": request})
            if not serializer.is_valid():
                results.append({**result, "status": "rejected", "errors": serializer.errors})
                continue
            try:
                _, created = record_event(request.user, serializer.validated_data)
            except PlayLimitReached:
                results.append({**result, "status": "rejected", "errors": PLAY_LIMIT_ERROR})
                continue
            results.append({**result, "status": "created" if created else "duplicate"})
        return Response(EventBatchResponseSerializer({"results": results}).data)


class PlaybackStateThrottle(UserRateThrottle):
    scope = "playback_state"
    rate = "60/min"


class PlaybackStateView(APIView):
    """
    FR-53 recovery log. The player PUTs the current track and position during
    playback (e.g. every 10 s and on pause) and GETs it after a reconnect or app
    start to offer "Resume <track> at <position>".
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [PlaybackStateThrottle]

    @extend_schema(
        responses={
            200: PlaybackStateSerializer,
            204: OpenApiResponse(description="Nothing to resume."),
        }
    )
    def get(self, request: Request) -> Response:
        state = PlaybackState.objects.filter(user=request.user).first()
        playable = Song.objects.visible_to(request.user)
        if state is None or not playable.filter(pk=state.song_id).exists():
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(PlaybackStateSerializer(state).data)

    @extend_schema(request=PlaybackStateSerializer, responses=PlaybackStateSerializer)
    def put(self, request: Request) -> Response:
        serializer = PlaybackStateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        state, _ = PlaybackState.objects.update_or_create(
            user=request.user,
            defaults={
                "song": data["song"],
                "position_seconds": data.get("position_seconds", 0),
                "room": data.get("room"),
            },
        )
        return Response(PlaybackStateSerializer(state).data)

    @extend_schema(responses={204: None})
    def delete(self, request: Request) -> Response:
        """Clear the log, e.g. when playback finished and there is nothing to resume."""
        PlaybackState.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _range_payload(query: dict) -> dict:
    return {
        "start": query["start"],
        "end": query["end"],
        "interval": query["interval"].value,
        "tz": timezone.get_current_timezone_name(),
    }


class DashboardView(APIView):
    """UC-16 / FR-37: aggregated statistics for the requesting musician's own tracks."""

    permission_classes = [IsMusician]

    @extend_schema(parameters=[StatsQuerySerializer], responses=DashboardSerializer)
    def get(self, request: Request) -> Response:
        query_serializer = StatsQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        query = query_serializer.validated_data
        start, end, interval = query["start"], query["end"], query["interval"]

        songs = Song.objects.filter(artist=request.user)
        stats = services.track_stats(songs, start, end)
        payload = {
            "range": _range_payload(query),
            "total_plays": sum(s.plays for s in stats),
            "tracks": stats,
            "top_tracks": services.top_tracks(stats),
            "plays_over_time": services.plays_over_time(songs, start, end, interval),
        }
        return Response(DashboardSerializer(payload).data)


class SongStatsView(APIView):
    """FR-39: statistics for one track; only its own musician may read them."""

    permission_classes = [IsMusician]

    @extend_schema(parameters=[StatsQuerySerializer], responses=SongStatsSerializer)
    def get(self, request: Request, song_id: int) -> Response:
        # Drafts the user cannot see are 404, so their existence is not revealed;
        # another musician's published track is 403 as FR-39 specifies.
        song = get_object_or_404(Song.objects.visible_to(request.user), pk=song_id)
        if song.artist_id != request.user.id:
            raise PermissionDenied("You can only view statistics for your own tracks.")

        query_serializer = StatsQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        query = query_serializer.validated_data
        start, end, interval = query["start"], query["end"], query["interval"]

        songs = Song.objects.filter(pk=song.pk)
        payload = {
            "range": _range_payload(query),
            "track": services.track_stats(songs, start, end)[0],
            "plays_over_time": services.plays_over_time(songs, start, end, interval),
        }
        return Response(SongStatsSerializer(payload).data)

from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.catalogue.models import Song

from . import services
from .models import PlaybackState
from .permissions import IsMusician
from .recording import record_event
from .serializers import (
    DashboardSerializer,
    EventBatchResponseSerializer,
    EventBatchSerializer,
    ListeningEventSerializer,
    PlaybackStateSerializer,
    SongStatsSerializer,
    StatsQuerySerializer,
)


class ListeningEventThrottle(UserRateThrottle):
    """Caps event spam that would inflate play counts; generous for normal playback."""

    scope = "listening_events"
    rate = "120/min"


class ListeningEventCreateView(APIView):
    """UC-15: players report play start, skip and completion events."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ListeningEventThrottle]

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
        event, created = record_event(request.user, serializer.validated_data)
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(ListeningEventSerializer(event).data, status=code)


class ListeningEventBatchThrottle(UserRateThrottle):
    # The web queue sends every event through this endpoint (one code path for
    # online and offline), so it must allow fast skipping.
    scope = "listening_event_batches"
    rate = "60/min"


class ListeningEventBatchView(APIView):
    """
    FR-53: events buffered while offline are uploaded together on reconnection.
    Each item is validated and stored on its own, so one bad event cannot block the
    queue; the per-item status tells the client what to drop from its buffer.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ListeningEventBatchThrottle]

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
            _, created = record_event(request.user, serializer.validated_data)
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

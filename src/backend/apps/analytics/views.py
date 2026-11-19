from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
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
from .models import ListeningEvent
from .permissions import IsMusician
from .serializers import (
    DashboardSerializer,
    ListeningEventSerializer,
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
        client_event_id = serializer.validated_data["client_event_id"]

        existing = ListeningEvent.objects.filter(
            user=request.user, client_event_id=client_event_id
        ).first()
        if existing:
            return Response(ListeningEventSerializer(existing).data, status=status.HTTP_200_OK)

        try:
            with transaction.atomic():
                event = serializer.save(user=request.user)
        except IntegrityError:
            # A concurrent retry stored the same event first.
            event = ListeningEvent.objects.get(user=request.user, client_event_id=client_event_id)
            return Response(ListeningEventSerializer(event).data, status=status.HTTP_200_OK)
        return Response(ListeningEventSerializer(event).data, status=status.HTTP_201_CREATED)


def _range_payload(query: dict) -> dict:
    return {"start": query["start"], "end": query["end"], "interval": query["interval"].value}


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
        song = get_object_or_404(Song, pk=song_id)
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

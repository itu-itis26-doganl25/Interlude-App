"""
Room API (WBS-9.1): create, list, join and leave listening rooms.

Capacity, private rooms and search come in WBS-9.3; real-time presence in
WBS-10.1. Every endpoint needs a logged-in user.
"""
from django.db.models import Count
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import media, services
from .models import Room
from .serializers import (
    MediaAccessSerializer,
    RoomDetailSerializer,
    RoomSerializer,
    RoomWithMediaSerializer,
)

ROOM_GONE = "This room is no longer available."


class MediaServerUnavailable(APIException):
    status_code = 503
    default_detail = "Room audio is not available right now."
    default_code = "media_server_unavailable"


@extend_schema_view(
    list=extend_schema(summary="List active rooms"),
    retrieve=extend_schema(summary="Get a room with its participants"),
    create=extend_schema(
        summary="Create a room (you become its host)", responses={201: RoomWithMediaSerializer}
    ),
    join=extend_schema(summary="Join a room", request=None, responses=RoomWithMediaSerializer),
    leave=extend_schema(
        summary="Leave a room (host passes on; the last one out closes it)",
        request=None,
        responses={204: None},
    ),
    media_token=extend_schema(
        summary="Get a fresh media-server token (participants only, e.g. to reconnect)",
        request=None,
        responses=MediaAccessSerializer,
    ),
)
@extend_schema(tags=["rooms"])
class RoomViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    lookup_value_regex = r"\d+"  # /api/rooms/abc/ is a 404, not a server error

    def get_queryset(self):
        queryset = (
            Room.objects.filter(is_active=True)
            .select_related("host", "current_song")
            .annotate(participant_count=Count("participants"))
            # Meta.ordering is ignored in aggregate queries, so order explicitly
            .order_by("-created_at", "-id")
        )
        if self.action != "list":
            queryset = queryset.prefetch_related("participants__user")
        return queryset

    def get_serializer_class(self):
        return RoomSerializer if self.action == "list" else RoomDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = RoomSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room = services.create_room(host=request.user, name=serializer.validated_data["name"])
        return Response(self._room_page(room, with_media=True), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        try:
            room = services.join_room(room_id=pk, user=request.user)
        except (Room.DoesNotExist, services.RoomClosed):
            raise NotFound(ROOM_GONE) from None
        return Response(self._room_page(room, with_media=True))

    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        try:
            services.leave_room(room_id=pk, user=request.user)
        except Room.DoesNotExist:
            raise NotFound(ROOM_GONE) from None
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="media-token")
    def media_token(self, request, pk=None):
        room = self.get_object()  # active rooms only, so a closed room is a 404
        if not room.participants.filter(user=request.user).exists():
            raise PermissionDenied("Join the room first.")
        access = media.issue_access(room, request.user)
        if access is None:
            raise MediaServerUnavailable
        return Response(MediaAccessSerializer(access).data)

    def _room_page(self, room, *, with_media=False):
        """The room as the room page shows it, with fresh counts after a change."""
        data = RoomDetailSerializer(self.get_queryset().get(pk=room.pk)).data
        if with_media:
            access = media.issue_access(room, self.request.user)
            data["media"] = MediaAccessSerializer(access).data if access else None
        return data

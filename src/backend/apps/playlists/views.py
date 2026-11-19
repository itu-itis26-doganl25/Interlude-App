"""
Playlist rules (WBS-8.3, FR-47, FR-48). Enforced server-side.

| Action                         | Owner | Other user / anonymous           |
|--------------------------------|-------|----------------------------------|
| List own, create               | yes   | no (401 when anonymous)          |
| Retrieve                       | yes   | only if displayed, else 404      |
| Rename, display toggle, delete | yes   | no (404, existence is not shown) |
| Add / remove songs             | yes   | no (404)                         |
| A user's displayed playlists   | yes   | yes                              |
"""

from django.db.models import Count, Prefetch, Q, QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.request import Request
from rest_framework.response import Response

from apps.catalogue.models import Song

from . import services
from .models import Playlist, PlaylistItem
from .serializers import (
    AddSongSerializer,
    PlaylistDetailSerializer,
    PlaylistItemSerializer,
    PlaylistSerializer,
)

PUBLIC_READ_ACTIONS = {"retrieve", "for_user"}


class PlaylistViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in PUBLIC_READ_ACTIONS:
            return [IsAuthenticatedOrReadOnly()]
        return [IsAuthenticated()]

    def get_queryset(self) -> QuerySet[Playlist]:
        if getattr(self, "swagger_fake_view", False):  # OpenAPI schema generation
            return Playlist.objects.none()
        user = self.request.user
        qs = (
            Playlist.objects.select_related("owner")
            .annotate(item_count=Count("items"))
            # Meta.ordering is dropped on aggregated queries; keep pagination stable.
            .order_by("-created_at", "-id")
        )
        if self.action == "for_user":
            return qs.filter(is_displayed=True)
        if self.action == "retrieve":
            items = PlaylistItem.objects.select_related("song__artist")
            qs = qs.prefetch_related(Prefetch("items", queryset=items))
            visible = Q(is_displayed=True)
            return qs.filter(visible | Q(owner=user) if user.is_authenticated else visible)
        # Listing and every write are limited to the user's own playlists.
        return qs.filter(owner=user)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PlaylistDetailSerializer
        return PlaylistSerializer

    def perform_create(self, serializer):
        playlist = serializer.save(owner=self.request.user)
        playlist.item_count = 0  # not annotated on a freshly created row

    def retrieve(self, request: Request, *args, **kwargs) -> Response:
        playlist = self.get_object()
        song_ids = {item.song_id for item in playlist.items.all()}  # prefetched
        playable = set(
            Song.objects.visible_to(request.user)
            .filter(id__in=song_ids)
            .values_list("id", flat=True)
        )
        serializer = PlaylistDetailSerializer(
            playlist, context={**self.get_serializer_context(), "playable_song_ids": playable}
        )
        return Response(serializer.data)

    @extend_schema(request=AddSongSerializer, responses={201: PlaylistItemSerializer})
    @action(detail=True, methods=["post"], url_path="items")
    def add_song(self, request: Request, pk=None) -> Response:
        playlist = self.get_object()
        serializer = AddSongSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        song = serializer.validated_data["song"]
        item = services.append_song(playlist, song)
        data = PlaylistItemSerializer(item, context={"playable_song_ids": {song.id}}).data
        return Response(data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={204: None})
    @action(detail=True, methods=["delete"], url_path=r"items/(?P<item_id>[0-9]+)")
    def remove_song(self, request: Request, pk=None, item_id=None) -> Response:
        playlist = self.get_object()
        get_object_or_404(PlaylistItem, pk=item_id, playlist=playlist).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses=PlaylistSerializer(many=True))
    @action(detail=False, methods=["get"], url_path=r"users/(?P<user_id>[0-9]+)")
    def for_user(self, request: Request, user_id=None) -> Response:
        """Playlists a user chose to show on their public profile (FR-48)."""
        queryset = self.get_queryset().filter(owner_id=user_id)
        page = self.paginate_queryset(queryset)
        serializer = PlaylistSerializer(page, many=True, context=self.get_serializer_context())
        return self.get_paginated_response(serializer.data)

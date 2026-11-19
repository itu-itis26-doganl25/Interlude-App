"""
Catalogue API: song and album CRUD (WBS-5.1) with search, filtering, sorting
and pagination (WBS-7.1). Streaming comes in WBS-8.1.
"""
from django.db.models import Count, Prefetch, Q
from django.db.models.functions import Lower
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .filters import AlbumFilter, SongFilter, StableOrderingFilter
from .models import Album, Song
from .pagination import CataloguePagination
from .permissions import IsMusicianToCreate, IsOwnerOrAdmin
from .serializers import (
    AlbumDetailSerializer,
    AlbumSerializer,
    SongSerializer,
    delete_files_on_commit,
)


class OwnedMediaViewSet(viewsets.ModelViewSet):
    """Shared behaviour: owner is the logged-in musician; files go with the record."""

    permission_classes = [IsMusicianToCreate, IsOwnerOrAdmin]
    pagination_class = CataloguePagination
    filter_backends = [DjangoFilterBackend, SearchFilter, StableOrderingFilter]
    ordering = ["-created_at"]  # newest first unless ?ordering= is given
    file_fields: tuple[str, ...] = ()

    def perform_create(self, serializer):
        serializer.save(artist=self.request.user)

    def perform_destroy(self, instance):
        names = [getattr(instance, f).name for f in self.file_fields]
        storage = instance._meta.get_field(self.file_fields[0]).storage
        instance.delete()
        delete_files_on_commit(names, storage)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def mine(self, request):
        """The logged-in musician's own items, drafts included (Studio page)."""
        queryset = self.filter_queryset(self.get_queryset()).filter(artist=request.user)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)


@extend_schema_view(
    list=extend_schema(summary="List and search songs (published, plus your own drafts)"),
    retrieve=extend_schema(summary="Get a song"),
    create=extend_schema(summary="Upload a song (musicians only)"),
    partial_update=extend_schema(summary="Edit a song's metadata or replace its files"),
    destroy=extend_schema(summary="Delete a song and its files"),
    mine=extend_schema(
        summary="Your songs, including unpublished ones",
        filters=True,
        responses=SongSerializer(many=True),
    ),
)
@extend_schema(tags=["catalogue"])
class SongViewSet(OwnedMediaViewSet):
    serializer_class = SongSerializer
    file_fields = ("audio_file", "cover")
    filterset_class = SongFilter
    search_fields = ["title", "artist__username", "album__title", "genre"]
    ordering_fields = ["created_at", "title"]

    def get_queryset(self):
        return Song.objects.visible_to(self.request.user)

    @extend_schema(
        summary="Genres that have published songs (for browse filters)",
        responses=serializers.ListSerializer(child=serializers.CharField()),
    )
    @action(detail=False, methods=["get"], pagination_class=None, filter_backends=[])
    def genres(self, request):
        genres = (
            Song.objects.filter(is_published=True)
            .exclude(genre="")
            .annotate(name=Lower("genre"))
            .order_by("name")
            .values_list("name", flat=True)
            .distinct()
        )
        return Response(list(genres))


@extend_schema_view(
    list=extend_schema(summary="List and search albums"),
    retrieve=extend_schema(summary="Get an album with its songs"),
    create=extend_schema(summary="Create an album (musicians only)"),
    partial_update=extend_schema(summary="Edit an album"),
    destroy=extend_schema(summary="Delete an album (its songs are kept)"),
    mine=extend_schema(
        summary="Your albums", filters=True, responses=AlbumSerializer(many=True)
    ),
)
@extend_schema(tags=["catalogue"])
class AlbumViewSet(OwnedMediaViewSet):
    file_fields = ("cover",)
    filterset_class = AlbumFilter
    search_fields = ["title", "artist__username"]
    ordering_fields = ["created_at", "title", "release_date"]

    def get_queryset(self):
        queryset = (
            Album.objects.select_related("artist")
            .annotate(song_count=Count("songs", filter=Q(songs__is_published=True)))
            # Meta.ordering is ignored in aggregate queries, so order explicitly
            .order_by("-created_at", "-id")
        )
        if self.action == "retrieve":
            visible_songs = Song.objects.visible_to(self.request.user).order_by(
                "track_number", "created_at"
            )
            queryset = queryset.prefetch_related(
                Prefetch("songs", queryset=visible_songs, to_attr="visible_songs")
            )
        return queryset

    def get_serializer_class(self):
        return AlbumDetailSerializer if self.action == "retrieve" else AlbumSerializer

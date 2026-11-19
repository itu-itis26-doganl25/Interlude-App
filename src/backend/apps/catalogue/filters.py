"""
Search, filter and sort options for the catalogue (WBS-7.1).

Examples:
    /api/catalogue/songs/?search=love
    /api/catalogue/songs/?genre=jazz&ordering=title
    /api/catalogue/songs/?artist=3&album=7
    /api/catalogue/albums/?search=live&ordering=-release_date
"""
from django_filters import rest_framework as filters
from rest_framework.filters import OrderingFilter

from .models import Album, Song


class SongFilter(filters.FilterSet):
    genre = filters.CharFilter(lookup_expr="iexact", help_text="Exact genre, any case.")
    # ?genre=jazz becomes Song.objects.filter(genre__iexact="jazz")
    # iexact ignores the case but an exact match
    artist = filters.NumberFilter(field_name="artist", help_text="Artist (user) id.")
    album = filters.NumberFilter(field_name="album", help_text="Album id.")
    is_published = filters.BooleanFilter(
        help_text="Mainly for the Studio page: drafts (false) or published (true)."
    )

    class Meta:
        model = Song
        fields = ["genre", "artist", "album", "is_published"]


class AlbumFilter(filters.FilterSet):
    artist = filters.NumberFilter(field_name="artist", help_text="Artist (user) id.")

    class Meta:
        model = Album
        fields = ["artist"]


class StableOrderingFilter(OrderingFilter):
    """
    Adds the id as a tie-breaker, so items with the same title or date keep a
    fixed order and never appear twice or go missing across pages.
    """

    def get_ordering(self, request, queryset, view):
        ordering = list(super().get_ordering(request, queryset, view) or [])
        if not any(field.lstrip("-") == "id" for field in ordering):
            descending = bool(ordering) and ordering[0].startswith("-")
            ordering.append("-id" if descending else "id")
        return ordering

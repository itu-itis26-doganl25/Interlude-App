"This file sets up how Album and Song models look and behave in the Django admin site at /admin/"
from django.contrib import admin

from .models import Album, Song


class SongInline(admin.TabularInline):
    model = Song
    extra = 0
    fields = ("track_number", "title", "is_published")


@admin.register(Album)
# Makes albums appear in the admin.
class AlbumAdmin(admin.ModelAdmin):
    list_display = ("title", "artist", "release_date", "created_at")
    search_fields = ("title", "artist__username")
    inlines = [SongInline]


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ("title", "artist", "album", "genre", "is_published", "created_at")
    list_filter = ("is_published", "genre")
    search_fields = ("title", "artist__username", "album__title")
    readonly_fields = ("file_size", "mime_type", "created_at", "updated_at")

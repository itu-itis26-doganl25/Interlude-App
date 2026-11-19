from django.contrib import admin

from .models import Playlist, PlaylistItem


class PlaylistItemInline(admin.TabularInline):
    model = PlaylistItem
    extra = 0
    fields = ("position", "song", "added_at")
    readonly_fields = ("added_at",)
    raw_id_fields = ("song",)


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "is_displayed", "created_at")
    list_filter = ("is_displayed",)
    search_fields = ("name", "owner__username")
    inlines = [PlaylistItemInline]

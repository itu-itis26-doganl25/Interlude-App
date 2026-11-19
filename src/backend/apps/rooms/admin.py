"Shows listening rooms and who is in them in the Django admin site at /admin/"
from django.contrib import admin

from .models import Room, RoomParticipant


class ParticipantInline(admin.TabularInline):
    """Who is in the room right now, in join order."""

    model = RoomParticipant
    extra = 0
    fields = ("user", "joined_at")
    readonly_fields = fields


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name", "host", "is_active", "created_at", "closed_at")
    list_filter = ("is_active",)
    search_fields = ("name", "host__username")
    inlines = [ParticipantInline]

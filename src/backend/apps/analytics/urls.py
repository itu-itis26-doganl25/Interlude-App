from django.urls import path

from .views import (
    DashboardView,
    ListeningEventCreateView,
    PlaybackStateView,
    SongStatsView,
)

app_name = "analytics"

urlpatterns = [
    path("events/", ListeningEventCreateView.as_view(), name="event-create"),
    path("playback-state/", PlaybackStateView.as_view(), name="playback-state"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("songs/<int:song_id>/", SongStatsView.as_view(), name="song-stats"),
]

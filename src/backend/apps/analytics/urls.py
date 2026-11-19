from django.urls import path

from .views import DashboardView, ListeningEventCreateView, SongStatsView

app_name = "analytics"

urlpatterns = [
    path("events/", ListeningEventCreateView.as_view(), name="event-create"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("songs/<int:song_id>/", SongStatsView.as_view(), name="song-stats"),
]

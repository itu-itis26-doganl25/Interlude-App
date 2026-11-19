from django.urls import path

from .views import ListeningEventCreateView

app_name = "analytics"

urlpatterns = [
    path("events/", ListeningEventCreateView.as_view(), name="event-create"),
]

from rest_framework.routers import SimpleRouter

from .views import PlaylistViewSet

app_name = "playlists"

router = SimpleRouter()
router.register("", PlaylistViewSet, basename="playlist")

urlpatterns = router.urls

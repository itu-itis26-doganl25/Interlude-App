from rest_framework.routers import DefaultRouter

from .views import AlbumViewSet, SongViewSet

router = DefaultRouter()
router.register("albums", AlbumViewSet, basename="album")
router.register("songs", SongViewSet, basename="song")

urlpatterns = router.urls

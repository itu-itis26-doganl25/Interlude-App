from rest_framework.routers import SimpleRouter

from .views import RoomViewSet

app_name = "rooms"

router = SimpleRouter()
router.register("", RoomViewSet, basename="room")

urlpatterns = router.urls

from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

def health(request):
    """Liveness check used by CI smoke tests and Azure health probes."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/auth/", include("apps.accounts.urls")),  # WBS-2.1
    # Each app adds its own routes here as it is built, e.g.
    path("api/catalogue/", include("apps.catalogue.urls")),   # WBS-5.1
    path("api/rooms/", include("apps.rooms.urls")),   # WBS-9.1
    path("api-auth/", include("rest_framework.urls")),   # login/logout for the browsable API
    # to try 
]

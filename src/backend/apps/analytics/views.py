from django.db import IntegrityError, transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .models import ListeningEvent
from .serializers import ListeningEventSerializer


class ListeningEventThrottle(UserRateThrottle):
    """Caps event spam that would inflate play counts; generous for normal playback."""

    scope = "listening_events"
    rate = "120/min"


class ListeningEventCreateView(APIView):
    """UC-15: players report play start, skip and completion events."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ListeningEventThrottle]

    @extend_schema(
        request=ListeningEventSerializer,
        responses={
            201: ListeningEventSerializer,
            200: OpenApiResponse(
                ListeningEventSerializer, description="Retried event; already stored."
            ),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = ListeningEventSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        client_event_id = serializer.validated_data["client_event_id"]

        existing = ListeningEvent.objects.filter(
            user=request.user, client_event_id=client_event_id
        ).first()
        if existing:
            return Response(ListeningEventSerializer(existing).data, status=status.HTTP_200_OK)

        try:
            with transaction.atomic():
                event = serializer.save(user=request.user)
        except IntegrityError:
            # A concurrent retry stored the same event first.
            event = ListeningEvent.objects.get(user=request.user, client_event_id=client_event_id)
            return Response(ListeningEventSerializer(event).data, status=status.HTTP_200_OK)
        return Response(ListeningEventSerializer(event).data, status=status.HTTP_201_CREATED)

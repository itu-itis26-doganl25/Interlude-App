"""
Owner: Sudenaz. Registration, login and logout endpoints (WBS-2.1).
Web clients use the session endpoints; the mobile app uses the token endpoints in urls.py.
"""

from django.contrib.auth import login, logout
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    """Create a listener or musician account (FR-03, FR-04)."""

    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(generics.GenericAPIView):
    """Web login: checks the credentials and starts a session cookie (FR-05, FR-06)."""

    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=UserSerializer)
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    """Web logout: ends the session (FR-07)."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveAPIView):
    """The logged-in user and their role, so the frontend knows which pages to show (FR-01)."""

    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
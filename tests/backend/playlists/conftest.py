"""
Fixtures for playlist tests. The shared fixtures in src/backend/conftest.py do not
reach tests/backend/, so users and safety settings are declared here.
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalogue.models import Song


@pytest.fixture(autouse=True)
def test_settings(settings):
    """No HTTPS redirect, no real disk or Azure storage."""
    settings.SECURE_SSL_REDIRECT = False
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }


def _user(username: str, role: str = User.Role.LISTENER) -> User:
    return User.objects.create_user(
        username=username, email=f"{username}@example.com", password="pw-123456!", role=role
    )


@pytest.fixture
def owner(db):
    return _user("elif")


@pytest.fixture
def other_user(db):
    return _user("mert")


@pytest.fixture
def musician(db):
    return _user("artist1", User.Role.MUSICIAN)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def client_for():
    def _client(user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    return _client


@pytest.fixture
def make_song(musician):
    def _make(title="Track", published=True, artist=None):
        return Song.objects.create(
            title=title,
            artist=artist or musician,
            audio_file=SimpleUploadedFile("t.mp3", b"\x00" * 16, content_type="audio/mpeg"),
            rights_confirmed=published,
            is_published=published,
            duration_seconds=180,
        )

    return _make

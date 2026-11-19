"""
Fixtures for analytics tests. The shared fixtures in src/backend/conftest.py do
not reach tests/backend/, so the users and safety settings are declared here.
"""

from datetime import datetime, time

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.analytics.models import ListeningEvent
from apps.catalogue.models import Song


@pytest.fixture(autouse=True)
def test_settings(settings):
    """No HTTPS redirect, no real disk or Azure storage."""
    settings.SECURE_SSL_REDIRECT = False
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


def _user(username: str, role: str = User.Role.LISTENER) -> User:
    return User.objects.create_user(
        username=username, email=f"{username}@example.com", password="pw-123456!", role=role
    )


@pytest.fixture
def musician(db):
    return _user("artist1", User.Role.MUSICIAN)


@pytest.fixture
def other_musician(db):
    return _user("artist2", User.Role.MUSICIAN)


@pytest.fixture
def listener(db):
    return _user("listener1")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_song():
    def _make(artist, title="Track", published=True, duration=None):
        return Song.objects.create(
            title=title,
            artist=artist,
            audio_file=SimpleUploadedFile("t.mp3", b"\x00" * 16, content_type="audio/mpeg"),
            rights_confirmed=published,
            is_published=published,
            duration_seconds=duration,
        )

    return _make


@pytest.fixture
def make_event():
    """Create an event at a given local date (noon), bypassing auto_now_add."""

    def _make(song, user=None, event_type=ListeningEvent.EventType.PLAY, on=None, room=None):
        event = ListeningEvent.objects.create(
            song=song, user=user, event_type=event_type, room=room
        )
        if on is not None:
            when = datetime.combine(on, time(12), tzinfo=timezone.get_current_timezone())
            ListeningEvent.objects.filter(pk=event.pk).update(created_at=when)
        return event

    return _make

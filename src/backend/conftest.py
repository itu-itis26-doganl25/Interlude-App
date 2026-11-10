import pytest

from apps.accounts.models import User


@pytest.fixture(autouse=True)
def in_memory_storage(settings):
    """Tests never touch the real disk or Azure."""
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }


@pytest.fixture
def musician(db):
    return User.objects.create_user(
        username="artist1", email="artist1@example.com", password="pw-123456!",
        role=User.Role.MUSICIAN,
    )


@pytest.fixture
def other_musician(db):
    return User.objects.create_user(
        username="artist2", email="artist2@example.com", password="pw-123456!",
        role=User.Role.MUSICIAN,
    )

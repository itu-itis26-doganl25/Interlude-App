import pytest

from apps.accounts.models import User

# fixture part means that this function prepares something tests can ask for by name. global var like
# created individually and only when asked for, and then cleaned after
@pytest.fixture(autouse=True)
def no_https_redirect(settings):
    """CI runs with DEBUG off, which turns on the HTTPS redirect; the test client uses http."""
    settings.SECURE_SSL_REDIRECT = False


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


@pytest.fixture
def listener(db):
    return User.objects.create_user(
        username="listener1", email="listener1@example.com", password="pw-123456!",
    )


@pytest.fixture
def platform_admin(db):
    return User.objects.create_user(
        username="admin1", email="admin1@example.com", password="pw-123456!",
        role=User.Role.ADMIN,
    )


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()

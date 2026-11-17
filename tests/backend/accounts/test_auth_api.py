"""
API tests for registration, login and logout (WBS-2.1).
Written before the views (test-first); each section names the requirement it checks.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role, User

PW = "Str0ng-pass!"

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def elif_user():
    return User.objects.create_user("elif", "elif@example.com", PW)


def register(api, **overrides):
    data = {"username": "mert", "email": "mert@example.com", "password": PW, "role": "musician"}
    data.update(overrides)
    return api.post(reverse("auth:register"), data, format="json")


def login(api, username="elif", password=PW):
    return api.post(
        reverse("auth:login"), {"username": username, "password": password}, format="json"
    )


def get_tokens(api, username="elif", password=PW):
    return api.post(
        reverse("auth:token"), {"username": username, "password": password}, format="json"
    )


# --- registration (FR-03, FR-04, NFR-01) ---


def test_register_creates_user_with_chosen_role(api):
    response = register(api)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["role"] == Role.MUSICIAN
    assert "password" not in response.data
    user = User.objects.get(username="mert")
    assert user.role == Role.MUSICIAN
    assert user.password.startswith("argon2")  # NFR-01: stored only as an Argon2 hash


def test_register_cannot_choose_admin_role(api):
    response = register(api, role="admin")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "role" in response.data
    assert not User.objects.filter(username="mert").exists()


@pytest.mark.parametrize(
    "overrides, bad_field",
    [
        ({"username": "elif"}, "username"),          # username taken
        ({"email": "ELIF@example.com"}, "email"),    # e-mail taken (different case)
        ({"email": "not-an-email"}, "email"),        # malformed e-mail
        ({"password": "123"}, "password"),           # too short
        ({"password": "password123"}, "password"),   # too common
    ],
)
def test_register_rejects_invalid_input(api, elif_user, overrides, bad_field):
    response = register(api, **overrides)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert bad_field in response.data  # FR-04: the message names the invalid field
    assert User.objects.count() == 1  # only elif exists, nothing new was created


# --- web login / logout with session (FR-05, FR-06, FR-07) ---


def test_session_login_then_me(api, elif_user):
    response = login(api)

    assert response.status_code == status.HTTP_200_OK
    assert response.data["username"] == "elif"
    me = api.get(reverse("auth:me"))
    assert me.status_code == status.HTTP_200_OK
    assert me.data["role"] == Role.LISTENER


def test_session_login_with_email(api, elif_user):
    assert login(api, username="Elif@Example.com").status_code == status.HTTP_200_OK


def test_login_error_is_generic(api, elif_user):
    wrong_password = login(api, password="wrong-pass!")
    unknown_user = login(api, username="nobody")

    assert wrong_password.status_code == status.HTTP_400_BAD_REQUEST
    assert unknown_user.status_code == status.HTTP_400_BAD_REQUEST
    assert wrong_password.data == unknown_user.data  # FR-06: doesn't reveal which part was wrong
    assert api.get(reverse("auth:me")).status_code == status.HTTP_401_UNAUTHORIZED


def test_deactivated_user_cannot_log_in(api, elif_user):
    elif_user.is_active = False
    elif_user.save()

    assert login(api).status_code == status.HTTP_400_BAD_REQUEST


def test_session_logout(api, elif_user):
    login(api)

    response = api.post(reverse("auth:logout"))

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert api.get(reverse("auth:me")).status_code == status.HTTP_401_UNAUTHORIZED


def test_me_requires_login(api):
    assert api.get(reverse("auth:me")).status_code == status.HTTP_401_UNAUTHORIZED


# --- mobile login / logout with JWT (FR-05, FR-06, FR-07, FR-40) ---


def test_token_login_and_bearer_access(api, elif_user):
    response = get_tokens(api)

    assert response.status_code == status.HTTP_200_OK
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    assert api.get(reverse("auth:me")).data["username"] == "elif"


def test_token_login_error_is_generic(api, elif_user):
    wrong_password = get_tokens(api, password="wrong-pass!")
    unknown_user = get_tokens(api, username="nobody")

    assert wrong_password.status_code == status.HTTP_401_UNAUTHORIZED
    assert unknown_user.status_code == status.HTTP_401_UNAUTHORIZED
    assert wrong_password.data == unknown_user.data
    assert "access" not in wrong_password.data


def test_refresh_rotates_and_blacklists_old_token(api, elif_user):
    old_refresh = get_tokens(api).data["refresh"]

    response = api.post(reverse("auth:token-refresh"), {"refresh": old_refresh}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["refresh"] != old_refresh
    reused = api.post(reverse("auth:token-refresh"), {"refresh": old_refresh}, format="json")
    assert reused.status_code == status.HTTP_401_UNAUTHORIZED


def test_token_logout_blacklists_refresh_token(api, elif_user):
    tokens = get_tokens(api).data
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    response = api.post(reverse("auth:token-logout"), {"refresh": tokens["refresh"]}, format="json")

    assert response.status_code == status.HTTP_200_OK
    reused = api.post(reverse("auth:token-refresh"), {"refresh": tokens["refresh"]}, format="json")
    assert reused.status_code == status.HTTP_401_UNAUTHORIZED
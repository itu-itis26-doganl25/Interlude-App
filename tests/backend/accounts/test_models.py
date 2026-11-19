import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.accounts.models import SELF_REGISTRATION_ROLES, Role, User

PW = "Str0ng-pass!"

pytestmark = pytest.mark.django_db


def make_user(username="elif", email=None, **extra):
    return User.objects.create_user(username, email or f"{username}@example.com", PW, **extra)


# --- roles (FR-09, FR-10) ---


def test_default_role_is_listener():
    user = make_user()
    assert user.role == Role.LISTENER
    assert user.is_listener
    assert not user.is_staff


def test_musician_helpers():
    musician = make_user("mira", role=Role.MUSICIAN)
    assert musician.is_musician
    assert musician.has_role(Role.MUSICIAN, Role.ADMIN)
    assert musician in User.objects.musicians()


def test_nested_role_alias_still_works():
    assert User.Role.MUSICIAN == Role.MUSICIAN


def test_superuser_is_admin_and_staff():
    admin = User.objects.create_superuser("deniz", "deniz@example.com", PW)
    assert admin.role == Role.ADMIN
    assert admin.is_platform_admin
    assert admin.is_staff


def test_superuser_with_other_role_is_rejected():
    with pytest.raises(ValueError):
        User.objects.create_superuser("x", "x@example.com", PW, role=Role.LISTENER)


def test_promote_and_demote_admin_updates_staff():
    user = make_user()
    user.role = Role.ADMIN
    user.save()
    user.refresh_from_db()
    assert user.is_staff

    user.role = Role.MUSICIAN
    user.save()
    user.refresh_from_db()
    assert not user.is_staff


def test_role_change_with_update_fields_also_saves_staff():
    user = make_user()
    user.role = Role.ADMIN
    user.save(update_fields=["role"])
    user.refresh_from_db()
    assert user.is_staff


def test_invalid_role_rejected_by_validation():
    user = User(username="bad", email="bad@example.com", role="superstar")
    user.set_password(PW)
    with pytest.raises(ValidationError):
        user.full_clean()


def test_invalid_role_rejected_by_database():
    user = make_user()
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.filter(pk=user.pk).update(role="superstar")


def test_admin_cannot_be_chosen_at_registration():
    assert Role.ADMIN not in SELF_REGISTRATION_ROLES
    assert set(SELF_REGISTRATION_ROLES) == {Role.LISTENER, Role.MUSICIAN}


def test_deactivated_flag_is_stored():
    user = make_user()
    user.is_active = False
    user.save()
    user.refresh_from_db()
    assert not user.is_active


# --- identity (FR-04, NFR-01) ---


def test_email_is_normalised_to_lowercase():
    user = make_user(email="  Elif@Example.COM ")
    assert user.email == "elif@example.com"


def test_email_unique_ignoring_case():
    make_user("a", email="same@example.com")
    with pytest.raises(IntegrityError), transaction.atomic():
        make_user("b", email="SAME@example.com")


def test_username_unique():
    make_user("dup", email="one@example.com")
    with pytest.raises(IntegrityError), transaction.atomic():
        make_user("dup", email="two@example.com")


def test_password_stored_as_argon2_hash():
    user = make_user()
    assert user.password.startswith("argon2")
    assert PW not in user.password
    assert user.check_password(PW)
"""
Owner: C (Sudenaz). Custom user with exactly one role (WBS-1.4).
Registration (WBS-2.x), permissions (WBS-3.1) and profiles (WBS-4.x) build on it.
"""

from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import UserManager as DjangoUserManager
from django.db import models


class Role(models.TextChoices):
    LISTENER = "listener", "Listener"
    MUSICIAN = "musician", "Musician"
    ADMIN = "admin", "Admin"


SELF_REGISTRATION_ROLES = (Role.LISTENER, Role.MUSICIAN)


class UserManager(DjangoUserManager):
    def create_user(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", Role.LISTENER)
        return super().create_user(username, email, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", Role.ADMIN)
        if extra_fields["role"] != Role.ADMIN:
            raise ValueError("Superuser must have role=admin.")
        return super().create_superuser(username, email, password, **extra_fields)

    def listeners(self):
        return self.filter(role=Role.LISTENER)

    def musicians(self):
        return self.filter(role=Role.MUSICIAN)

    def admins(self):
        return self.filter(role=Role.ADMIN)


class User(AbstractUser):
    Role = Role  # keeps `User.Role.MUSICIAN` working (used in conftest.py)

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=16, choices=Role.choices, default=Role.LISTENER, db_index=True
    )

    objects = UserManager()

    class Meta(AbstractUser.Meta):
        constraints = [
            models.CheckConstraint(
                condition=models.Q(role__in=Role.values),
                name="accounts_user_role_valid",
            ),
        ]

    def __str__(self) -> str:
        return self.username

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        # The role is the single source of truth: superusers are always admins,
        # and only admins can open the Django admin site.
        if self.is_superuser:
            self.role = Role.ADMIN
        self.is_staff = self.role == Role.ADMIN

        update_fields = kwargs.get("update_fields")
        if update_fields is not None and {"role", "is_superuser"} & set(update_fields):
            kwargs["update_fields"] = set(update_fields) | {"role", "is_staff"}
        super().save(*args, **kwargs)

    # --- role helpers (used by the permission classes in WBS-3.1) ---
    def has_role(self, *roles) -> bool:
        return self.role in roles

    @property
    def is_listener(self) -> bool:
        return self.role == Role.LISTENER

    @property
    def is_musician(self) -> bool:
        return self.role == Role.MUSICIAN

    @property
    def is_platform_admin(self) -> bool:
        return self.role == Role.ADMIN

"""
Owner: C (Sudenaz). Minimal custom user so that the first migration is made.
Profiles, registration and permissions are added in WBS-2.x / 3.1 / 4.x.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        LISTENER = "listener", "Listener"
        MUSICIAN = "musician", "Musician"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.LISTENER)

    @property
    def is_musician(self) -> bool:
        return self.role == self.Role.MUSICIAN

    def __str__(self) -> str:
        return self.username

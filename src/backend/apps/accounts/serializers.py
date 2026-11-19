"""
Owner: Sudenaz. Serializers for registration, login and the current user (WBS-2.1).
"""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import SELF_REGISTRATION_ROLES, User


class UserSerializer(serializers.ModelSerializer):
    """Public view of a user, returned by register, login and /me."""

    class Meta:
        model = User
        fields = ("id", "username", "email", "role")
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    role = serializers.ChoiceField(choices=SELF_REGISTRATION_ROLES)  # admin is not allowed

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "role")
        read_only_fields = ("id",)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this e-mail already exists.")
        return email

    def validate(self, attrs):
        # Validate the password using Django's built-in validators.
        # A temporary, unsaved user lets the similarity check compare the
        # password with the username and e-mail.
        candidate = User(username=attrs["username"], email=attrs["email"])
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs

    def create(self, validated_data):
        # create_user hashes the password (Argon2) instead of storing it as text.
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(help_text="Username or e-mail address.")
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    default_error_messages = {
        "invalid_credentials": "Invalid username or password.",
    }

    def validate(self, attrs):
        identifier = attrs["username"].strip()
        if "@" in identifier:
            match = User.objects.filter(email__iexact=identifier).first()
            if match is not None:
                identifier = match.username

        user = authenticate(
            self.context.get("request"), username=identifier, password=attrs["password"]
        )
        if user is None:
            # Same message for unknown user, wrong password and deactivated account (FR-06).
            self.fail("invalid_credentials")

        attrs["user"] = user
        return attrs
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class InterludeUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Interlude", {"fields": ("role",)}),)
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "email", "role", "password1", "password2"),
            },
        ),
    )
    list_display = ("username", "email", "role", "is_active")
    list_filter = ("role", "is_active")
    # is_staff is derived from the role in User.save(); change the role instead.
    readonly_fields = ("is_staff", "last_login", "date_joined")
    
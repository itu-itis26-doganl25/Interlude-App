from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class InterludeUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Interlude", {"fields": ("role",)}),)
    list_display = ("username", "email", "role", "is_staff")
    list_filter = ("role", "is_staff")

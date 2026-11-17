"""Django admin"""
import pytest

from apps.catalogue.models import Album, Song

pytestmark = pytest.mark.django_db


def test_album_admin_lists_songs_but_cannot_add_them(admin_client, musician):
    album = Album.objects.create(title="LP", artist=musician)
    response = admin_client.get(f"/admin/catalogue/album/{album.id}/change/")
    assert response.status_code == 200
    formset = response.context["inline_admin_formsets"][0]
    assert formset.has_add_permission is False


def test_saving_album_in_admin_does_not_create_songs(admin_client, musician):
    album = Album.objects.create(title="LP", artist=musician)
    response = admin_client.post(
        f"/admin/catalogue/album/{album.id}/change/",
        {
            "title": "LP renamed",
            "artist": musician.id,
            "description": "",
            "songs-TOTAL_FORMS": "1",
            "songs-INITIAL_FORMS": "0",
            "songs-0-title": "Sneaky",
            "songs-0-track_number": "1",
        },
    )
    assert response.status_code == 302
    album.refresh_from_db()
    assert album.title == "LP renamed"
    assert not Song.objects.exists()
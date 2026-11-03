import pytest


@pytest.mark.django_db
def test_health_endpoint(client):
    response = client.get("/api/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_openapi_schema_builds(client):
    response = client.get("/api/schema/")
    assert response.status_code == 200

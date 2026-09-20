import pytest
from tracker.models import WorkItem, Project, APIKey

@pytest.mark.django_db
class TestNinjaAPI:
    def test_hello_endpoint(self, ninja_client):
        response = ninja_client.get("/hello")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert "message" in response.json()

    def test_health_endpoint(self, ninja_client):
        response = ninja_client.get("/health")
        assert response.status_code == 200
        assert response.json()["database"] == "connected"
        assert response.json()["orm"] == "django-6.1"

    def test_info_endpoint(self, ninja_client):
        response = ninja_client.get("/info")
        assert response.status_code == 200
        assert "django" in response.json()
        assert "ninja" in response.json()

    def test_auth_me_unauthorized(self, ninja_client):
        # 1. No auth headers
        response = ninja_client.get("/auth/me")
        assert response.status_code == 401

        # 2. Invalid auth header
        response = ninja_client.get("/auth/me", headers={"X-API-Key": "dav_live_fake"})
        assert response.status_code == 401

    def test_auth_me_authorized_via_header(self, ninja_client, test_user, test_api_key):
        _, raw_key = test_api_key
        response = ninja_client.get("/auth/me", headers={"X-API-Key": raw_key})
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email

    def test_auth_me_authorized_via_query_param(self, ninja_client, test_user, test_api_key):
        _, raw_key = test_api_key
        response = ninja_client.get(f"/auth/me?api_key={raw_key}")
        assert response.status_code == 200
        assert response.json()["username"] == test_user.username

    def test_api_key_management_flow(self, ninja_client, test_user, test_api_key):
        _, raw_key = test_api_key

        # 1. Generate a second key via API
        create_res = ninja_client.post(
            "/auth/keys",
            json={"name": "Second Key"},
            headers={"X-API-Key": raw_key}
        )
        assert create_res.status_code == 200
        new_key_data = create_res.json()
        assert "raw_key" in new_key_data
        assert new_key_data["name"] == "Second Key"
        new_key_id = new_key_data["id"]

        # 2. List keys
        list_res = ninja_client.get("/auth/keys", headers={"X-API-Key": raw_key})
        assert list_res.status_code == 200
        keys_list = list_res.json()
        assert len(keys_list) == 2

        # 3. Revoke the second key
        del_res = ninja_client.delete(f"/auth/keys/{new_key_id}", headers={"X-API-Key": raw_key})
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "revoked"

        # 4. List keys again - revoked key should no longer be in active list
        list_res2 = ninja_client.get("/auth/keys", headers={"X-API-Key": raw_key})
        assert len(list_res2.json()) == 1

    def test_work_items_crud(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key

        # 1. Create a work item
        create_res = ninja_client.post(
            "/work-items",
            json={
                "title": "Automated Test Ticket",
                "description": "Created during pytest suite",
                "priority": "HIGH",
                "status": "TODO",
                "project_key": test_project.key
            },
            headers={"X-API-Key": raw_key}
        )
        assert create_res.status_code == 200
        ticket = create_res.json()
        assert ticket["title"] == "Automated Test Ticket"
        assert ticket["key"].startswith("DAV-")
        assert ticket["reporter"] == test_user.username
        ticket_key = ticket["key"]

        # 2. List work items
        list_res = ninja_client.get("/work-items")
        assert list_res.status_code == 200
        items = list_res.json()
        assert any(i["key"] == ticket_key for i in items)

        # 3. Update work item
        patch_res = ninja_client.patch(
            f"/work-items/{ticket_key}",
            json={"status": "IN_PROGRESS", "priority": "LOW"},
            headers={"X-API-Key": raw_key}
        )
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["status"] == "IN_PROGRESS"
        assert updated["priority"] == "LOW"

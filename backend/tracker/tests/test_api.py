import pytest
from tracker.models import WorkItem, Project, APIKey, Sprint, Release

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
        response = ninja_client.get("/auth/me")
        assert response.status_code == 401

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

    def test_auth_me_authorized_via_remote_user(self, ninja_client):
        response = ninja_client.get(
            "/auth/me",
            headers={
                "Remote-User": "authelia_admin",
                "Remote-Email": "authelia@ecmwf.int",
                "Remote-Name": "Authelia Admin",
                "Remote-Groups": "admins,dev",
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "authelia_admin"
        assert data["email"] == "authelia@ecmwf.int"
        assert data["is_staff"] is True

    def test_auth_me_authorized_via_authelia_cookie(self, ninja_client, monkeypatch):
        class MockResponse:
            status = 200
            headers = {
                "Remote-User": "cookie_user",
                "Remote-Email": "cookie_user@ecmwf.int",
                "Remote-Name": "Cookie User",
                "Remote-Groups": "dev",
            }
            def __enter__(self):
                return self
            def __exit__(self, exc_type, exc_val, exc_tb):
                pass

        import urllib.request
        monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout=2.0: MockResponse())

        response = ninja_client.get(
            "/auth/me",
            COOKIES={"authelia_session": "test_session_token_123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "cookie_user"
        assert data["email"] == "cookie_user@ecmwf.int"

    def test_auth_me_authorized_via_jwt(self, ninja_client, monkeypatch):
        mock_claims = {
            "preferred_username": "jwt_user",
            "email": "jwt_user@ecmwf.int",
            "name": "JWT User",
            "groups": ["dev", "ecmwf"],
        }
        from tracker import auth
        monkeypatch.setattr(auth, "verify_oidc_jwt", lambda token: mock_claims if token == "valid_token_abc" else None)

        response = ninja_client.get(
            "/auth/me",
            headers={"Authorization": "Bearer valid_token_abc"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "jwt_user"
        assert data["email"] == "jwt_user@ecmwf.int"
        assert data["is_staff"] is True

    def test_auth_me_invalid_jwt(self, ninja_client, monkeypatch):
        from tracker import auth
        monkeypatch.setattr(auth, "verify_oidc_jwt", lambda token: None)

        response = ninja_client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid_token_xyz"}
        )
        assert response.status_code == 401

    def test_api_key_management_flow(self, ninja_client, test_user, test_api_key):
        _, raw_key = test_api_key

        # 1. Generate key
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
        assert len(list_res.json()) == 2

        # 3. Revoke key
        del_res = ninja_client.delete(f"/auth/keys/{new_key_id}", headers={"X-API-Key": raw_key})
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "revoked"

        # 4. List keys again
        list_res2 = ninja_client.get("/auth/keys", headers={"X-API-Key": raw_key})
        assert len(list_res2.json()) == 1

    def test_project_and_status_endpoints(self, ninja_client, test_user, test_api_key):
        _, raw_key = test_api_key

        # Create new project
        res = ninja_client.post(
            "/projects",
            json={"key": "CORE", "name": "Core Platform", "description": "Platform services"},
            headers={"X-API-Key": raw_key}
        )
        assert res.status_code == 200
        proj_data = res.json()
        assert proj_data["key"] == "CORE"
        assert len(proj_data["statuses"]) == 6

        # Fetch statuses
        statuses_res = ninja_client.get("/projects/CORE/statuses")
        assert statuses_res.status_code == 200
        statuses = statuses_res.json()
        assert [s["name"] for s in statuses] == ["todo", "in progress", "review", "waiting", "done", "cancelled"]

    def test_sprint_and_release_endpoints(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key

        # Create Release
        rel_res = ninja_client.post(
            f"/projects/{test_project.key}/releases",
            json={"name": "v1.0.0", "description": "First public release"},
            headers={"X-API-Key": raw_key}
        )
        assert rel_res.status_code == 200
        rel_data = rel_res.json()
        assert rel_data["name"] == "v1.0.0"
        rel_id = rel_data["id"]

        # Create Sprint linked to release
        sp_res = ninja_client.post(
            f"/projects/{test_project.key}/sprints",
            json={"name": "Sprint 1", "description": "Initial setup", "release_id": rel_id},
            headers={"X-API-Key": raw_key}
        )
        assert sp_res.status_code == 200
        assert sp_res.json()["name"] == "Sprint 1"
        assert sp_res.json()["release_id"] == rel_id

    def test_work_items_crud_with_subtasks(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key

        # 1. Create parent work item
        parent_res = ninja_client.post(
            "/work-items",
            json={
                "title": "Epic Work Item",
                "descr": "Parent task for testing subtask hierarchy",
                "priority": "HIGH",
                "status": "todo",
                "project_key": test_project.key,
                "source": "https://linear.app/issue/123"
            },
            headers={"X-API-Key": raw_key}
        )
        assert parent_res.status_code == 200
        parent = parent_res.json()
        assert parent["title"] == "Epic Work Item"
        assert parent["key"].startswith("DAV-")
        assert parent["created_by"] == test_user.username
        assert parent["status"] == "todo"
        parent_key = parent["key"]

        # 2. Create subtask
        child_res = ninja_client.post(
            "/work-items",
            json={
                "title": "Subtask 1",
                "descr": "Child subtask",
                "parent_key": parent_key,
                "project_key": test_project.key,
                "status": "in progress"
            },
            headers={"X-API-Key": raw_key}
        )
        assert child_res.status_code == 200
        child = child_res.json()
        assert child["parent_key"] == parent_key
        assert child["status"] == "in progress"
        child_key = child["key"]

        # 3. Update child item
        patch_res = ninja_client.patch(
            f"/work-items/{child_key}",
            json={"status": "done", "priority": "LOW"},
            headers={"X-API-Key": raw_key}
        )
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["status"] == "done"
        assert updated["priority"] == "LOW"

    def test_context_and_progress_flow(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key

        # 1. Create item
        item_res = ninja_client.post(
            "/work-items",
            json={"title": "Agent Feature Work", "descr": "Task for LLM", "project_key": test_project.key},
            headers={"X-API-Key": raw_key}
        )
        assert item_res.status_code == 200
        item_key = item_res.json()["key"]

        # 2. Set Context
        ctx_markdown = "# Technical Guidelines\n- Use Django ORM\n- Follow models.md"
        put_ctx = ninja_client.put(
            f"/work-items/{item_key}/context",
            json={"t": ctx_markdown},
            headers={"X-API-Key": raw_key}
        )
        assert put_ctx.status_code == 200
        assert put_ctx.json()["t"] == ctx_markdown

        # 3. Get Context
        get_ctx = ninja_client.get(f"/work-items/{item_key}/context")
        assert get_ctx.status_code == 200
        assert get_ctx.json()["t"] == ctx_markdown
        assert get_ctx.json()["user"] == test_user.username

        # 4. Log Progress with Proof (git sha)
        prog_res = ninja_client.post(
            f"/work-items/{item_key}/progress",
            json={
                "t": "Implemented models and ran migrations",
                "proof": "git:8f3a9e2",
                "status": "COMPLETED"
            },
            headers={"X-API-Key": raw_key}
        )
        assert prog_res.status_code == 200
        prog_data = prog_res.json()
        assert prog_data["proof"] == "git:8f3a9e2"
        assert prog_data["status"] == "COMPLETED"

        # 5. List progress
        prog_list_res = ninja_client.get(f"/work-items/{item_key}/progress")
        assert prog_list_res.status_code == 200
        assert len(prog_list_res.json()) == 1
        assert prog_list_res.json()[0]["proof"] == "git:8f3a9e2"

    def test_delete_sprint_release_and_work_item(self, ninja_client, test_user, test_api_key):
        _, raw_key = test_api_key
        # 1. Create project
        p_res = ninja_client.post("/projects", json={"key": "DEL", "name": "Deletion Test"}, headers={"X-API-Key": raw_key})
        assert p_res.status_code == 200

        # 2. Create release and delete it
        rel_res = ninja_client.post("/projects/DEL/releases", json={"name": "v0.1"}, headers={"X-API-Key": raw_key})
        assert rel_res.status_code == 200
        rel_id = rel_res.json()["id"]

        del_rel = ninja_client.delete(f"/projects/DEL/releases/{rel_id}", headers={"X-API-Key": raw_key})
        assert del_rel.status_code == 200
        assert del_rel.json()["success"] is True

        # 3. Create sprint and delete it
        sp_res = ninja_client.post("/projects/DEL/sprints", json={"name": "Sprint Del"}, headers={"X-API-Key": raw_key})
        assert sp_res.status_code == 200
        sp_id = sp_res.json()["id"]

        del_sp = ninja_client.delete(f"/projects/DEL/sprints/{sp_id}", headers={"X-API-Key": raw_key})
        assert del_sp.status_code == 200
        assert del_sp.json()["success"] is True

        # 4. Create work item and delete it
        wi_res = ninja_client.post("/work-items", json={"project_key": "DEL", "title": "Temporary item", "status": "todo"}, headers={"X-API-Key": raw_key})
        assert wi_res.status_code == 200
        wi_key = wi_res.json()["key"]

        del_wi = ninja_client.delete(f"/work-items/{wi_key}", headers={"X-API-Key": raw_key})
        assert del_wi.status_code == 200
        assert del_wi.json()["success"] is True

        # Verify 404 after deletion
        assert ninja_client.get(f"/work-items/{wi_key}").status_code == 404

    def test_update_sprint_and_release(self, ninja_client, test_user, test_api_key):
        _, raw_key = test_api_key
        p_res = ninja_client.post("/projects", json={"key": "UPD", "name": "Update Test"}, headers={"X-API-Key": raw_key})
        assert p_res.status_code == 200

        # Create and patch release
        rel_res = ninja_client.post("/projects/UPD/releases", json={"name": "v1.0-alpha"}, headers={"X-API-Key": raw_key})
        rel_id = rel_res.json()["id"]

        patch_rel = ninja_client.patch(
            f"/projects/UPD/releases/{rel_id}",
            json={"name": "v1.0-beta", "description": "Beta release notes"},
            headers={"X-API-Key": raw_key}
        )
        assert patch_rel.status_code == 200
        assert patch_rel.json()["name"] == "v1.0-beta"
        assert patch_rel.json()["description"] == "Beta release notes"

        # Create and patch sprint
        sp_res = ninja_client.post("/projects/UPD/sprints", json={"name": "Sprint 1"}, headers={"X-API-Key": raw_key})
        sp_id = sp_res.json()["id"]

        patch_sp = ninja_client.patch(
            f"/projects/UPD/sprints/{sp_id}",
            json={"name": "Sprint 1 Renamed", "description": "New sprint objective"},
            headers={"X-API-Key": raw_key}
        )
        assert patch_sp.status_code == 200
        assert patch_sp.json()["name"] == "Sprint 1 Renamed"
        assert patch_sp.json()["description"] == "New sprint objective"


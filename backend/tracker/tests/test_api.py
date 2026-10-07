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

    def test_auth_me_authorized_via_django_session(self, client, test_user):
        client.force_login(test_user)
        response = client.get("/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email

    def test_oidc_login_redirect(self, client):
        response = client.get("/api/auth/login")
        assert response.status_code == 302
        assert "/api/oidc/authorization" in response.url
        assert "client_id=davai" in response.url
        assert "code_challenge=" in response.url
        assert "code_challenge_method=S256" in response.url
        # mozilla-django-oidc stores states in oidc_states dict
        states = client.session.get("oidc_states")
        assert states is not None
        assert len(states) > 0
        state = list(states.keys())[0]
        assert states[state].get("code_verifier") is not None

    def test_oidc_login_redirect_with_forwarded_headers(self, client):
        response = client.get(
            "/api/auth/login",
            HTTP_X_FORWARDED_PROTO="https",
            HTTP_HOST="davai.dtasev.co.uk"
        )
        assert response.status_code == 302
        assert response.url.startswith("https://davai.dtasev.co.uk/authelia/api/oidc/authorization?")
        assert "redirect_uri=https%3A%2F%2Fdavai.dtasev.co.uk%2Fapi%2Fauth%2Foidc%2Fcallback" in response.url

    def test_oidc_callback_flow(self, client, monkeypatch):
        # 1. Initiate login to set session state
        client.get("/api/auth/login")
        states = client.session.get("oidc_states")
        saved_state = list(states.keys())[0]

        # 2. Mock token exchange and verify_token in DavaiOIDCAuthenticationBackend
        from tracker.auth import DavaiOIDCAuthenticationBackend
        monkeypatch.setattr(
            DavaiOIDCAuthenticationBackend,
            "get_token",
            lambda self, payload: {"id_token": "dummy_jwt", "access_token": "token_123"}
        )
        monkeypatch.setattr(
            DavaiOIDCAuthenticationBackend,
            "verify_token",
            lambda self, id_token, **kwargs: {
                "preferred_username": "oidc_session_user",
                "email": "session_user@ecmwf.int",
                "name": "Session User",
                "groups": ["dev"],
            }
        )
        monkeypatch.setattr(
            DavaiOIDCAuthenticationBackend,
            "get_userinfo",
            lambda self, access_token, id_token, payload: {
                "preferred_username": "oidc_session_user",
                "email": "session_user@ecmwf.int",
                "name": "Session User",
                "groups": ["dev"],
            }
        )

        # 3. Call callback with matching state
        cb_res = client.get(f"/api/auth/oidc/callback?code=test_code_123&state={saved_state}")
        assert cb_res.status_code == 302
        assert cb_res.url == "/"

        # 4. Request /api/auth/me using the newly established session cookie!
        me_res = client.get("/api/auth/me")
        assert me_res.status_code == 200
        data = me_res.json()
        assert data["username"] == "oidc_session_user"
        assert data["email"] == "session_user@ecmwf.int"

    def test_oidc_logout(self, client, test_user):
        from tracker.auth import _AUTHELIA_SESSION_CACHE
        _AUTHELIA_SESSION_CACHE["dummy_authelia_cookie"] = (test_user, 9999999999)

        client.force_login(test_user)
        client.cookies["authelia_session"] = "dummy_authelia_cookie"

        me_res = client.get("/api/auth/me")
        assert me_res.status_code == 200

        logout_res = client.post("/api/auth/logout")
        assert logout_res.status_code == 200
        assert logout_res.json() == {"ok": True}
        assert "dummy_authelia_cookie" not in _AUTHELIA_SESSION_CACHE
        assert logout_res.cookies["authelia_session"].value == ""

        me_after = client.get("/api/auth/me")
        assert me_after.status_code == 401

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
        assert len(proj_data["statuses"]) == 7

        # Fetch statuses
        statuses_res = ninja_client.get("/projects/CORE/statuses", headers={"X-API-Key": raw_key})
        assert statuses_res.status_code == 200
        statuses = statuses_res.json()
        assert [s["name"] for s in statuses] == ["todo", "planned", "in progress", "blocked", "review", "done", "cancelled"]

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
                "description": "Parent task for testing subtask hierarchy",
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
        assert parent["description"] == "Parent task for testing subtask hierarchy"
        assert parent["key"].startswith("DAV-")
        assert parent["created_by"] == test_user.username
        assert parent["status"] == "todo"
        parent_key = parent["key"]

        # 2. Create subtask
        child_res = ninja_client.post(
            "/work-items",
            json={
                "title": "Subtask 1",
                "description": "Child subtask",
                "parent_key": parent_key,
                "project_key": test_project.key,
                "status": "planned"
            },
            headers={"X-API-Key": raw_key}
        )
        assert child_res.status_code == 200
        child = child_res.json()
        assert child["parent_key"] == parent_key
        assert child["status"] == "planned"
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

        # 4. Fetch parent item - verify subtasks are included as a list view with key and title
        get_parent = ninja_client.get(f"/work-items/{parent_key}", headers={"X-API-Key": raw_key})
        assert get_parent.status_code == 200
        parent_data = get_parent.json()
        assert "subtasks" in parent_data
        assert parent_data["subtasks"] == [{"key": child_key, "title": "Subtask 1"}]

        # 5. Fetch child item - verify child has empty subtasks list
        get_child = ninja_client.get(f"/work-items/{child_key}", headers={"X-API-Key": raw_key})
        assert get_child.status_code == 200
        child_data = get_child.json()
        assert child_data["subtasks"] == []

        # 6. List work items - verify subtasks are present in list results
        list_res = ninja_client.get(f"/work-items?project_key={test_project.key}", headers={"X-API-Key": raw_key})
        assert list_res.status_code == 200
        items_map = {item["key"]: item for item in list_res.json()}
        assert items_map[parent_key]["subtasks"] == [{"key": child_key, "title": "Subtask 1"}]
        assert items_map[child_key]["subtasks"] == []

    def test_context_and_progress_flow(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key

        # 1. Create item
        item_res = ninja_client.post(
            "/work-items",
            json={"title": "Agent Feature Work", "description": "Task for LLM", "project_key": test_project.key},
            headers={"X-API-Key": raw_key}
        )
        assert item_res.status_code == 200
        item_key = item_res.json()["key"]

        # 2. Set Context
        ctx_markdown = "# Technical Guidelines\n- Use Django ORM\n- Follow models.md"
        put_ctx = ninja_client.put(
            f"/work-items/{item_key}/context",
            json={"summary": ctx_markdown},
            headers={"X-API-Key": raw_key}
        )
        assert put_ctx.status_code == 200
        assert put_ctx.json()["summary"] == ctx_markdown

        # 3. Get Context
        get_ctx = ninja_client.get(f"/work-items/{item_key}/context", headers={"X-API-Key": raw_key})
        assert get_ctx.status_code == 200
        assert get_ctx.json()["summary"] == ctx_markdown
        assert get_ctx.json()["user"] == test_user.username
        assert get_ctx.json()["updated_by"] == test_user.username
        assert "timestamp" in get_ctx.json()

        # 4. Log Progress with Proof (git sha) and agent_id
        # Missing agent_id via API key is rejected with 400
        missing_who_res = ninja_client.post(
            f"/work-items/{item_key}/progress",
            json={
                "summary": "Missing agent identifier",
                "proof": "git:8f3a9e2",
                "status": "in progress"
            },
            headers={"X-API-Key": raw_key}
        )
        assert missing_who_res.status_code == 400
        assert "agent_id" in missing_who_res.json()["detail"]

        prog_res = ninja_client.post(
            f"/work-items/{item_key}/progress",
            json={
                "summary": "Implemented models and ran migrations",
                "agent_id": "claude-code/sonnet/sess-1",
                "proof": "git:8f3a9e2",
                "status": "in progress"
            },
            headers={"X-API-Key": raw_key}
        )
        assert prog_res.status_code == 200
        prog_data = prog_res.json()
        assert prog_data["summary"] == "Implemented models and ran migrations"
        assert prog_data["agent_id"] == "claude-code/sonnet/sess-1"
        assert prog_data["proof"] == "git:8f3a9e2"
        assert prog_data["status"] == "in progress"
        assert prog_data["created_by"] == test_user.username
        assert "created_at" in prog_data
        assert prog_data["updated_by"] is None
        assert "updated_at" in prog_data

        # 5. List progress
        prog_list_res = ninja_client.get(f"/work-items/{item_key}/progress", headers={"X-API-Key": raw_key})
        assert prog_list_res.status_code == 200
        assert len(prog_list_res.json()) == 1
        assert prog_list_res.json()[0]["summary"] == "Implemented models and ran migrations"
        assert prog_list_res.json()[0]["agent_id"] == "claude-code/sonnet/sess-1"
        assert prog_list_res.json()[0]["proof"] == "git:8f3a9e2"
        assert prog_list_res.json()[0]["created_by"] == test_user.username
        assert "created_at" in prog_list_res.json()[0]

        # 6. Human / session-authenticated request without API key can omit agent_id (defaults to "")
        human_prog_res = ninja_client.post(
            f"/work-items/{item_key}/progress",
            json={
                "summary": "Human UI progress update",
                "proof": "git:9a1b2c3",
                "status": "review"
            },
            headers={
                "Remote-User": test_user.username,
                "Remote-Email": test_user.email,
            }
        )
        assert human_prog_res.status_code == 200
        assert human_prog_res.json()["agent_id"] == ""

    def test_create_work_item_with_context(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key
        res = ninja_client.post(
            "/work-items",
            json={
                "title": "Item With Direct Context",
                "description": "User requested feature",
                "context": "# Agent Plan\nImplementation steps.",
                "project_key": test_project.key,
            },
            headers={"X-API-Key": raw_key},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["title"] == "Item With Direct Context"
        assert data["description"] == "User requested feature"
        assert data["context"] is not None
        assert data["context"]["summary"] == "# Agent Plan\nImplementation steps."
        assert data["context"]["user"] == test_user.username
        assert data["context"]["updated_by"] == test_user.username
        assert "timestamp" in data["context"]

    def test_context_unversioned_overwrite_replaces_previous_value(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key

        item_res = ninja_client.post(
            "/work-items",
            json={"title": "Unversioned Context Item", "description": "Testing overwrite", "project_key": test_project.key},
            headers={"X-API-Key": raw_key}
        )
        assert item_res.status_code == 200
        item_key = item_res.json()["key"]

        # Initial context setting
        res1 = ninja_client.put(
            f"/work-items/{item_key}/context",
            json={"summary": "Fact 1: Initial architecture constraint"},
            headers={"X-API-Key": raw_key}
        )
        assert res1.status_code == 200
        assert res1.json()["summary"] == "Fact 1: Initial architecture constraint"
        assert res1.json()["updated_by"] == test_user.username
        assert res1.json()["user"] == test_user.username
        assert "timestamp" in res1.json()

        # Overwrite context with new latest facts
        res2 = ninja_client.put(
            f"/work-items/{item_key}/context",
            json={"summary": "Fact 2: Replaced architecture constraint"},
            headers={"X-API-Key": raw_key}
        )
        assert res2.status_code == 200
        # Confirms replacement, not append: previous value is completely gone
        assert res2.json()["summary"] == "Fact 2: Replaced architecture constraint"
        assert "Fact 1" not in res2.json()["summary"]

        # Confirm via GET that database stores only the latest state
        get_res = ninja_client.get(f"/work-items/{item_key}/context", headers={"X-API-Key": raw_key})
        assert get_res.status_code == 200
        assert get_res.json()["summary"] == "Fact 2: Replaced architecture constraint"
        assert "Fact 1" not in get_res.json()["summary"]
        assert get_res.json()["updated_by"] == test_user.username

        # Confirm single database record exists (no version history / rows accumulating)
        from tracker.models import Context, WorkItem
        item = WorkItem.objects.get(key=item_key)
        assert Context.objects.filter(work_item=item).count() == 1

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
        assert ninja_client.get(f"/work-items/{wi_key}", headers={"X-API-Key": raw_key}).status_code == 404

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

    def test_update_and_delete_progress(self, ninja_client, test_user, test_project, test_api_key):
        from django.contrib.auth.models import User
        from tracker.auth import generate_api_key

        _, raw_key = test_api_key

        # Create a work item
        wi_res = ninja_client.post(
            "/work-items",
            json={"title": "Progress Test Item", "description": "Testing edit/delete progress", "project_key": test_project.key},
            headers={"X-API-Key": raw_key}
        )
        assert wi_res.status_code == 200
        item_key = wi_res.json()["key"]

        # 1. Log initial progress
        post_res = ninja_client.post(
            f"/work-items/{item_key}/progress",
            json={
                "summary": "Initial step",
                "agent_id": "agent-1",
                "hostname": "dev-host-01",
                "proof": "git:abc1",
                "status": "planned",
            },
            headers={"X-API-Key": raw_key}
        )
        assert post_res.status_code == 200
        prog_id = post_res.json()["id"]
        assert post_res.json()["agent_id"] == "agent-1"
        assert post_res.json()["hostname"] == "dev-host-01"
        assert post_res.json()["created_by"] == test_user.username
        assert post_res.json()["updated_by"] is None
        assert "updated_at" in post_res.json()

        # 2. PATCH progress entry (happy path)
        patch_res = ninja_client.patch(
            f"/work-items/{item_key}/progress/{prog_id}",
            json={
                "summary": "Updated step",
                "agent_id": "agent-1-updated",
                "hostname": "dev-host-02",
                "proof": "git:def2",
                "status": "in progress",
            },
            headers={"X-API-Key": raw_key}
        )
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["id"] == prog_id
        assert updated["summary"] == "Updated step"
        assert updated["agent_id"] == "agent-1-updated"
        assert updated["hostname"] == "dev-host-02"
        assert updated["proof"] == "git:def2"
        assert updated["status"] == "in progress"
        assert updated["created_by"] == test_user.username
        assert updated["updated_by"] == test_user.username
        assert updated["updated_at"] is not None

        # 3. Permissions test: non-staff other user
        other_user = User.objects.create(username="other_dev", is_staff=False)
        _, other_key = generate_api_key(other_user, name="Other Dev Key")

        # other_user tries to edit test_user's progress -> 403 Forbidden
        forbidden_patch = ninja_client.patch(
            f"/work-items/{item_key}/progress/{prog_id}",
            json={"summary": "Malicious edit"},
            headers={"X-API-Key": other_key}
        )
        assert forbidden_patch.status_code == 403
        assert "permission" in forbidden_patch.json()["detail"].lower()

        # other_user tries to delete test_user's progress -> 403 Forbidden
        forbidden_del = ninja_client.delete(
            f"/work-items/{item_key}/progress/{prog_id}",
            headers={"X-API-Key": other_key}
        )
        assert forbidden_del.status_code == 403
        assert "permission" in forbidden_del.json()["detail"].lower()

        # other_user can create, edit, and delete their own progress entry
        other_post = ninja_client.post(
            f"/work-items/{item_key}/progress",
            json={"summary": "Other user progress", "agent_id": "other-agent", "proof": "git:other1"},
            headers={"X-API-Key": other_key}
        )
        assert other_post.status_code == 200
        other_prog_id = other_post.json()["id"]

        other_edit = ninja_client.patch(
            f"/work-items/{item_key}/progress/{other_prog_id}",
            json={"summary": "Other user updated progress"},
            headers={"X-API-Key": other_key}
        )
        assert other_edit.status_code == 200
        assert other_edit.json()["summary"] == "Other user updated progress"

        other_del = ninja_client.delete(
            f"/work-items/{item_key}/progress/{other_prog_id}",
            headers={"X-API-Key": other_key}
        )
        assert other_del.status_code == 200
        assert other_del.json()["success"] is True

        # 4. 404 tests
        assert ninja_client.patch(
            f"/work-items/NON-EXISTENT/progress/{prog_id}",
            json={"summary": "x"},
            headers={"X-API-Key": raw_key}
        ).status_code == 404

        assert ninja_client.patch(
            f"/work-items/{item_key}/progress/999999",
            json={"summary": "x"},
            headers={"X-API-Key": raw_key}
        ).status_code == 404

        assert ninja_client.delete(
            f"/work-items/NON-EXISTENT/progress/{prog_id}",
            headers={"X-API-Key": raw_key}
        ).status_code == 404

        assert ninja_client.delete(
            f"/work-items/{item_key}/progress/999999",
            headers={"X-API-Key": raw_key}
        ).status_code == 404

        # 5. DELETE progress (hard delete)
        del_res = ninja_client.delete(
            f"/work-items/{item_key}/progress/{prog_id}",
            headers={"X-API-Key": raw_key}
        )
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

        # Verify entry is completely gone from list
        list_res = ninja_client.get(f"/work-items/{item_key}/progress", headers={"X-API-Key": raw_key})
        assert list_res.status_code == 200
        assert len(list_res.json()) == 0

        # Verify work item details has 0 progress entries
        get_wi = ninja_client.get(f"/work-items/{item_key}", headers={"X-API-Key": raw_key})
        assert get_wi.status_code == 200
        assert len(get_wi.json()["progress"]) == 0

    def test_list_users_optimized(self, ninja_client, test_user, test_api_key):
        _, raw_key = test_api_key
        res = ninja_client.get("/users", headers={"X-API-Key": raw_key})
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        user_item = next(u for u in data if u["username"] == test_user.username)
        assert user_item == {"id": test_user.id, "username": test_user.username}

        # Accepts project argument as well
        res_with_project = ninja_client.get("/users?project=DAV", headers={"X-API-Key": raw_key})
        assert res_with_project.status_code == 200
        data_with_project = res_with_project.json()
        assert isinstance(data_with_project, list)
        assert any(u["username"] == test_user.username for u in data_with_project)

    def test_work_item_active_assignee_assignment_and_unassignment(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key

        # 1. Create work item without active_assignee_username -> defaults to creator (test_user)
        create_res = ninja_client.post(
            "/work-items",
            json={"title": "Assignee Test Item", "project_key": test_project.key},
            headers={"X-API-Key": raw_key}
        )
        assert create_res.status_code == 200
        item = create_res.json()
        assert item["active_assignee"] == test_user.username
        item_key = item["key"]

        # 1b. Create explicitly unassigned work item with empty string
        create_unassigned_res = ninja_client.post(
            "/work-items",
            json={"title": "Explicitly Unassigned", "project_key": test_project.key, "active_assignee_username": ""},
            headers={"X-API-Key": raw_key}
        )
        assert create_unassigned_res.status_code == 200
        assert create_unassigned_res.json()["active_assignee"] is None

        # 1c. Create explicitly unassigned work item with null
        create_null_res = ninja_client.post(
            "/work-items",
            json={"title": "Explicitly Null Assignee", "project_key": test_project.key, "active_assignee_username": None},
            headers={"X-API-Key": raw_key}
        )
        assert create_null_res.status_code == 200
        assert create_null_res.json()["active_assignee"] is None

        # 2. Assign user
        patch_res1 = ninja_client.patch(
            f"/work-items/{item_key}",
            json={"active_assignee_username": test_user.username},
            headers={"X-API-Key": raw_key}
        )
        assert patch_res1.status_code == 200
        assert patch_res1.json()["active_assignee"] == test_user.username

        # 3. Unassign with empty string
        patch_res2 = ninja_client.patch(
            f"/work-items/{item_key}",
            json={"active_assignee_username": ""},
            headers={"X-API-Key": raw_key}
        )
        assert patch_res2.status_code == 200
        assert patch_res2.json()["active_assignee"] is None

        # 4. Re-assign user
        patch_res3 = ninja_client.patch(
            f"/work-items/{item_key}",
            json={"active_assignee_username": test_user.username},
            headers={"X-API-Key": raw_key}
        )
        assert patch_res3.status_code == 200
        assert patch_res3.json()["active_assignee"] == test_user.username

        # 5. Unassign with null
        patch_res4 = ninja_client.patch(
            f"/work-items/{item_key}",
            json={"active_assignee_username": None},
            headers={"X-API-Key": raw_key}
        )
        assert patch_res4.status_code == 200
        assert patch_res4.json()["active_assignee"] is None

    def test_unauthenticated_requests_require_auth(
        self, ninja_client, test_user, test_project, test_api_key
    ):
        _, raw_key = test_api_key

        # Seed a work item with auth first to have a valid key for testing
        create_res = ninja_client.post(
            "/work-items",
            json={"title": "Test Auth Work Item", "project_key": test_project.key},
            headers={"X-API-Key": raw_key}
        )
        assert create_res.status_code == 200
        item_key = create_res.json()["key"]

        # 1. Verify GET operations require auth and return 401 when unauthenticated
        get_endpoints = [
            "/work-items",
            "/work-items/preview",
            f"/work-items/{item_key}",
            f"/work-items/{item_key}/progress",
            "/projects",
            f"/projects/{test_project.key}/statuses",
            f"/projects/{test_project.key}/releases",
            f"/projects/{test_project.key}/sprints",
            f"/projects/{test_project.key}/incidents",
            f"/projects/{test_project.key}/monitoring-logs",
            "/incidents",
            "/monitoring-logs",
            "/search",
            "/users",
        ]
        for endpoint in get_endpoints:
            res = ninja_client.get(endpoint)
            assert res.status_code == 401, f"Expected 401 for unauthenticated GET {endpoint}, got {res.status_code}"

            auth_res = ninja_client.get(endpoint, headers={"X-API-Key": raw_key})
            assert auth_res.status_code == 200, f"Expected 200 for authenticated GET {endpoint}, got {auth_res.status_code}"

        # 2. Verify modifying operations require auth and return 401 when unauthenticated
        mutating_requests = [
            # Work items
            ("post", "/work-items", {"title": "No Auth", "project_key": test_project.key}),
            ("patch", f"/work-items/{item_key}", {"title": "Hacked Title"}),
            ("delete", f"/work-items/{item_key}", None),
            ("put", f"/work-items/{item_key}/context", {"summary": "Hacked Context"}),
            ("post", f"/work-items/{item_key}/progress", {"summary": "Progress", "status": "IN_PROGRESS"}),
            ("patch", f"/work-items/{item_key}/progress/1", {"summary": "Progress Edit"}),
            ("delete", f"/work-items/{item_key}/progress/1", None),
            # Projects
            ("post", "/projects", {"key": "NEW", "name": "New Project"}),
            # Releases
            ("post", f"/projects/{test_project.key}/releases", {"name": "v9.9.9"}),
            ("patch", f"/projects/{test_project.key}/releases/1", {"name": "v9.9.9-patch"}),
            ("delete", f"/projects/{test_project.key}/releases/1", None),
            # Sprints
            ("post", f"/projects/{test_project.key}/sprints", {"name": "Sprint Unauthorized"}),
            ("patch", f"/projects/{test_project.key}/sprints/1", {"name": "Sprint Renamed"}),
            ("delete", f"/projects/{test_project.key}/sprints/1", None),
            # API Keys
            ("post", "/auth/keys", {"name": "Unauthorized Key"}),
            ("delete", "/auth/keys/1", None),
        ]
        for method, path, data in mutating_requests:
            fn = getattr(ninja_client, method)
            kwargs = {"json": data} if data is not None else {}
            res = fn(path, **kwargs)
            assert res.status_code == 401, (
                f"Expected 401 Unauthorized for unauthenticated {method.upper()} {path}, "
                f"got {res.status_code}: {res.content}"
            )

    def test_done_status_restricted_from_mcp_and_allowed_for_humans(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key

        # Create a work item
        create_res = ninja_client.post(
            "/work-items",
            json={"title": "Done Status Test Item", "project_key": test_project.key},
            headers={"X-API-Key": raw_key}
        )
        assert create_res.status_code == 200
        item_key = create_res.json()["key"]
        assert create_res.json()["status"] == "todo"

        # 1. MCP client attempts to log progress with status="done" -> 400 Refused
        mcp_headers = {"X-API-Key": raw_key, "User-Agent": "Davai-MCP-Client/1.0"}
        res_mcp = ninja_client.post(
            f"/work-items/{item_key}/progress",
            json={"summary": "Agent thinks it is done", "status": "done"},
            headers=mcp_headers
        )
        assert res_mcp.status_code == 400
        assert "only be set by a human via the frontend" in res_mcp.json()["detail"]

        # 2. MCP client attempts PATCH work-item with status="done" -> 400 Refused
        res_patch_mcp = ninja_client.patch(
            f"/work-items/{item_key}",
            json={"status": "done"},
            headers=mcp_headers
        )
        assert res_patch_mcp.status_code == 400
        assert "only be set by a human via the frontend" in res_patch_mcp.json()["detail"]

        # 3. Human / browser client logs progress with status="done" -> 200 OK
        human_headers = {"X-API-Key": raw_key, "User-Agent": "Mozilla/5.0"}
        res_human = ninja_client.post(
            f"/work-items/{item_key}/progress",
            json={"summary": "Human verified and completed", "agent_id": "human-tester", "status": "done"},
            headers=human_headers
        )
        assert res_human.status_code == 200
        assert res_human.json()["status"] == "done"

        # Verify work item status is now "done"
        get_res = ninja_client.get(f"/work-items/{item_key}", headers={"X-API-Key": raw_key})
        assert get_res.status_code == 200
        assert get_res.json()["status"] == "done"

    def test_work_item_status_derived_and_filtering(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key
        headers = {"X-API-Key": raw_key}

        # Item 1: No progress entries -> defaults to "todo"
        item1_res = ninja_client.post(
            "/work-items",
            json={"title": "Item Todo Only", "project_key": test_project.key},
            headers=headers
        )
        key1 = item1_res.json()["key"]
        assert item1_res.json()["status"] == "todo"

        # Item 2: Progress entry with "planned"
        item2_res = ninja_client.post(
            "/work-items",
            json={"title": "Item Planned", "project_key": test_project.key},
            headers=headers
        )
        key2 = item2_res.json()["key"]
        ninja_client.post(
            f"/work-items/{key2}/progress",
            json={"summary": "Plan ready", "agent_id": "agent-planner", "status": "planned"},
            headers=headers
        )

        # Item 3: Progress entry with "in progress"
        item3_res = ninja_client.post(
            "/work-items",
            json={"title": "Item In Progress", "project_key": test_project.key},
            headers=headers
        )
        key3 = item3_res.json()["key"]
        ninja_client.post(
            f"/work-items/{key3}/progress",
            json={"summary": "Step 1 done", "agent_id": "agent-builder", "status": "in progress"},
            headers=headers
        )

        # Filter by status=todo
        todo_res = ninja_client.get(f"/work-items?project_key={test_project.key}&status=todo", headers=headers)
        todo_keys = [i["key"] for i in todo_res.json()]
        assert key1 in todo_keys
        assert key2 not in todo_keys
        assert key3 not in todo_keys

        # Filter by status=planned
        planned_res = ninja_client.get(f"/work-items?project_key={test_project.key}&status=planned", headers=headers)
        planned_keys = [i["key"] for i in planned_res.json()]
        assert key2 in planned_keys
        assert key1 not in planned_keys

        # Filter by status=in progress
        step_res = ninja_client.get(f"/work-items?project_key={test_project.key}&status=in progress", headers=headers)
        step_keys = [i["key"] for i in step_res.json()]
        assert key3 in step_keys
        assert key1 not in step_keys

    def test_work_items_list_omits_details_and_detail_endpoint_includes_them(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key
        headers = {"X-API-Key": raw_key}

        # Create work item with description and context
        res = ninja_client.post(
            "/work-items",
            json={
                "title": "Item With Details",
                "description": "Full description markdown text",
                "context": "Full technical plan markdown",
                "project_key": test_project.key,
            },
            headers=headers,
        )
        assert res.status_code == 200
        item_key = res.json()["key"]

        # Add a progress entry
        prog_res = ninja_client.post(
            f"/work-items/{item_key}/progress",
            json={"summary": "Progress entry 1", "agent_id": "agent-runner", "status": "in progress"},
            headers=headers,
        )
        assert prog_res.status_code == 200

        # Verify GET /work-items omits description, context, and progress
        list_res = ninja_client.get(f"/work-items?project_key={test_project.key}", headers=headers)
        assert list_res.status_code == 200
        items = list_res.json()
        target = next(i for i in items if i["key"] == item_key)
        assert "description" not in target
        assert "context" not in target
        assert "progress" not in target
        assert target["title"] == "Item With Details"

        # Verify GET /work-items/{key} includes full details
        detail_res = ninja_client.get(f"/work-items/{item_key}", headers=headers)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["description"] == "Full description markdown text"
        assert detail["context"] is not None
        assert detail["context"]["summary"] == "Full technical plan markdown"
        assert len(detail["progress"]) == 1
        assert detail["progress"][0]["summary"] == "Progress entry 1"

    def test_invalid_status_rejected_across_api(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key
        headers = {"X-API-Key": raw_key}

        # 1. Create work item with invalid status -> 400
        res = ninja_client.post(
            "/work-items",
            json={"title": "Invalid Status", "project_key": test_project.key, "status": "completed"},
            headers=headers
        )
        assert res.status_code == 400
        assert "Invalid status 'completed'" in res.json()["detail"]

        # Valid create
        res = ninja_client.post(
            "/work-items",
            json={"title": "Valid Item", "project_key": test_project.key},
            headers=headers
        )
        assert res.status_code == 200
        key = res.json()["key"]

        # 2. Update work item with invalid status -> 400
        patch_res = ninja_client.patch(
            f"/work-items/{key}",
            json={"status": "completed"},
            headers=headers
        )
        assert patch_res.status_code == 400
        assert "Invalid status 'completed'" in patch_res.json()["detail"]

        # 3. Log progress with invalid status -> 400
        prog_res = ninja_client.post(
            f"/work-items/{key}/progress",
            json={"summary": "Invalid progress", "agent_id": "agent-validator", "status": "completed"},
            headers=headers
        )
        assert prog_res.status_code == 400
        assert "Invalid status 'completed'" in prog_res.json()["detail"]

        # Valid progress log
        prog_valid = ninja_client.post(
            f"/work-items/{key}/progress",
            json={"summary": "Valid progress", "agent_id": "agent-validator", "status": "in progress"},
            headers=headers
        )
        assert prog_valid.status_code == 200
        prog_id = prog_valid.json()["id"]

        # 4. Update progress with invalid status -> 400
        prog_patch = ninja_client.patch(
            f"/work-items/{key}/progress/{prog_id}",
            json={"status": "in_progress"},
            headers=headers
        )
        assert prog_patch.status_code == 400
        assert "Invalid status 'in_progress'" in prog_patch.json()["detail"]

    def test_sequential_work_item_creation_across_projects(self, ninja_client, test_user, test_api_key):
        from tracker.models import Project
        _, raw_key = test_api_key
        headers = {"X-API-Key": raw_key}

        p1 = Project.objects.create(key="PRJA", name="Project A")
        p2 = Project.objects.create(key="PRJB", name="Project B")

        # Create 3 items in Project A
        res_a1 = ninja_client.post("/work-items", json={"title": "A1", "project_key": p1.key}, headers=headers)
        res_a2 = ninja_client.post("/work-items", json={"title": "A2", "project_key": p1.key}, headers=headers)
        res_a3 = ninja_client.post("/work-items", json={"title": "A3", "project_key": p1.key}, headers=headers)
        assert res_a1.json()["key"] == "PRJA-1"
        assert res_a2.json()["key"] == "PRJA-2"
        assert res_a3.json()["key"] == "PRJA-3"

        # Create 2 items in Project B
        res_b1 = ninja_client.post("/work-items", json={"title": "B1", "project_key": p2.key}, headers=headers)
        res_b2 = ninja_client.post("/work-items", json={"title": "B2", "project_key": p2.key}, headers=headers)
        assert res_b1.json()["key"] == "PRJB-1"
        assert res_b2.json()["key"] == "PRJB-2"

        # Interleaved creation in Project A and Project B
        res_a4 = ninja_client.post("/work-items", json={"title": "A4", "project_key": p1.key}, headers=headers)
        res_b3 = ninja_client.post("/work-items", json={"title": "B3", "project_key": p2.key}, headers=headers)
        assert res_a4.json()["key"] == "PRJA-4"
        assert res_b3.json()["key"] == "PRJB-3"

    def test_incidents_and_monitoring_logs_api(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key
        headers = {"X-API-Key": raw_key}
        mcp_headers = {"X-API-Key": raw_key, "User-Agent": "Davai-MCP/1.0"}

        # Create a work item to link to an incident
        wi_res = ninja_client.post(
            "/work-items",
            json={"title": "Mitigate Redis connection spike", "project_key": test_project.key},
            headers=headers
        )
        assert wi_res.status_code == 200
        wi_key = wi_res.json()["key"]

        # 1. MCP (LLM) cannot create an incident with human-only status ("done" or "no longer relevant")
        res_forbidden_done = ninja_client.post(
            f"/projects/{test_project.key}/incidents",
            json={"title": "Test Done", "status": "done"},
            headers=mcp_headers
        )
        assert res_forbidden_done.status_code == 400
        assert "human" in res_forbidden_done.json()["detail"].lower()

        res_forbidden_nlr = ninja_client.post(
            f"/projects/{test_project.key}/incidents",
            json={"title": "Test NLR", "status": "no longer relevant"},
            headers=mcp_headers
        )
        assert res_forbidden_nlr.status_code == 400
        assert "human" in res_forbidden_nlr.json()["detail"].lower()

        # 2. Create incident via API key with valid status and linked work item
        inc_res = ninja_client.post(
            f"/projects/{test_project.key}/incidents",
            json={
                "title": "Redis Connection Pool Exhaustion",
                "cause": "Burst of un-cached worker requests during hourly cron.",
                "investigation_note": "Check redis_connected_clients metric and worker concurrency.",
                "status": "reported",
                "work_item_keys": [wi_key],
            },
            headers=mcp_headers
        )
        assert inc_res.status_code == 200
        inc_data = inc_res.json()
        assert inc_data["key"] == f"{test_project.key}-INC-1"
        assert inc_data["title"] == "Redis Connection Pool Exhaustion"
        assert inc_data["cause"] == "Burst of un-cached worker requests during hourly cron."
        assert inc_data["investigation_note"] == "Check redis_connected_clients metric and worker concurrency."
        assert inc_data["status"] == "reported"
        assert inc_data["work_item_keys"] == [wi_key]
        assert len(inc_data["work_items"]) == 1
        assert inc_data["work_items"][0]["key"] == wi_key
        inc_key = inc_data["key"]
        inc_id = inc_data["id"]

        # 3. Create monitoring log linked to the incident
        log_res = ninja_client.post(
            f"/projects/{test_project.key}/monitoring-logs",
            json={
                "agent_id": "ecmwf-watchdog/sonnet/sess-1",
                "description": "ERROR: redis_connected_clients=1024 exceeded threshold 800 on node-03",
                "status": "Error",
                "incident_id": inc_key,
                "jira_url": "https://jira.ecmwf.int/browse/OPS-42",
            },
            headers=mcp_headers
        )
        assert log_res.status_code == 200
        log_data = log_res.json()
        assert log_data["key"] == f"{test_project.key}-LOG-1"
        assert log_data["agent_id"] == "ecmwf-watchdog/sonnet/sess-1"
        assert log_data["status"] == "error"
        assert log_data["incident_id"] == inc_id
        assert log_data["incident_key"] == inc_key
        assert log_data["jira_url"] == "https://jira.ecmwf.int/browse/OPS-42"
        assert "exceeded threshold 800" in log_data["description"]
        log_key = log_data["key"]
        log_id = log_data["id"]

        # 4. Get incident by key and numeric id -> serializes linked log IDs without description
        get_inc = ninja_client.get(f"/incidents/{inc_key}", headers=headers)
        assert get_inc.status_code == 200
        get_inc_data = get_inc.json()
        assert get_inc_data["monitoring_log_ids"] == [log_id]
        assert get_inc_data["monitoring_log_keys"] == [log_key]
        assert len(get_inc_data["monitoring_logs"]) == 1
        assert get_inc_data["monitoring_logs"][0]["id"] == log_id
        assert get_inc_data["monitoring_logs"][0]["key"] == log_key
        assert "description" not in get_inc_data["monitoring_logs"][0]

        get_inc_by_id = ninja_client.get(f"/incidents/{inc_id}", headers=headers)
        assert get_inc_by_id.status_code == 200
        assert get_inc_by_id.json()["key"] == inc_key

        # 5. Get monitoring log by key and numeric id -> includes full description
        get_log = ninja_client.get(f"/monitoring-logs/{log_key}", headers=headers)
        assert get_log.status_code == 200
        assert "exceeded threshold 800" in get_log.json()["description"]

        get_log_by_id = ninja_client.get(f"/monitoring-logs/{log_id}", headers=headers)
        assert get_log_by_id.status_code == 200
        assert get_log_by_id.json()["key"] == log_key

        # 6. MCP (LLM) can update incident to "ongoing", but not "done" or "no longer relevant"
        upd_ongoing = ninja_client.patch(
            f"/incidents/{inc_key}",
            json={"status": "ongoing"},
            headers=mcp_headers
        )
        assert upd_ongoing.status_code == 200
        assert upd_ongoing.json()["status"] == "ongoing"

        upd_done_llm = ninja_client.patch(
            f"/incidents/{inc_key}",
            json={"status": "done"},
            headers=mcp_headers
        )
        assert upd_done_llm.status_code == 400

        upd_nlr_llm = ninja_client.patch(
            f"/incidents/{inc_key}",
            json={"status": "no longer relevant"},
            headers=mcp_headers
        )
        assert upd_nlr_llm.status_code == 400

        # 7. Human (Remote-User header, non-API-key) CAN set incident to "done" and "no longer relevant"
        human_headers = {
            "Remote-User": "human_engineer",
            "Remote-Email": "engineer@ecmwf.int",
        }
        upd_done_human = ninja_client.patch(
            f"/incidents/{inc_key}",
            json={"status": "done"},
            headers=human_headers
        )
        assert upd_done_human.status_code == 200
        assert upd_done_human.json()["status"] == "done"

        # Create a second incident and mark it "no longer relevant" as human
        inc2_res = ninja_client.post(
            f"/projects/{test_project.key}/incidents",
            json={
                "title": "Legacy NFS Mount Timeout on Decommissioned Cluster",
                "cause": "Old storage array latency",
                "status": "no longer relevant",
            },
            headers=human_headers
        )
        assert inc2_res.status_code == 200
        inc2_key = inc2_res.json()["key"]

        # 8. Search incidents -> "no longer relevant" is ALWAYS excluded even if matching query or requested in status filter
        from tracker.embedding import flush_indexing_queue
        flush_indexing_queue()

        search_res = ninja_client.get(f"/projects/{test_project.key}/incidents/search?q=Legacy+NFS", headers=headers)
        assert search_res.status_code == 200
        search_keys = [r["incident"]["key"] for r in search_res.json()["results"]]
        assert inc2_key not in search_keys

        search_kw = ninja_client.get(
            f"/projects/{test_project.key}/incidents/search?q=Legacy&mode=keyword&status=no+longer+relevant",
            headers=headers
        )
        assert search_kw.status_code == 200
        assert search_kw.json()["total"] == 0

    def test_sprint_and_release_statuses_and_done_at(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key
        human_headers = {"X-API-Key": raw_key, "User-Agent": "Mozilla/5.0"}
        mcp_headers = {"X-API-Key": raw_key, "User-Agent": "Davai-MCP-Client/1.0"}

        # 1. Create release (defaults to planned, done_at is None)
        rel_res = ninja_client.post(
            f"/projects/{test_project.key}/releases",
            json={"name": "v1.0.0", "description": "Release 1"},
            headers=human_headers
        )
        assert rel_res.status_code == 200
        rel_data = rel_res.json()
        assert rel_data["status"] == "planned"
        assert rel_data["done_at"] is None
        rel_id = rel_data["id"]

        # 2. MCP cannot mark release as done
        rel_mcp_done = ninja_client.patch(
            f"/projects/{test_project.key}/releases/{rel_id}",
            json={"status": "done"},
            headers=mcp_headers
        )
        assert rel_mcp_done.status_code == 400
        assert "human via the frontend" in rel_mcp_done.json()["detail"]

        # 3. MCP can mark release as in progress
        rel_mcp_prog = ninja_client.patch(
            f"/projects/{test_project.key}/releases/{rel_id}",
            json={"status": "in progress"},
            headers=mcp_headers
        )
        assert rel_mcp_prog.status_code == 200
        assert rel_mcp_prog.json()["status"] == "in progress"
        assert rel_mcp_prog.json()["done_at"] is None

        # 4. Human marks release as done -> records done_at
        rel_human_done = ninja_client.patch(
            f"/projects/{test_project.key}/releases/{rel_id}",
            json={"status": "done"},
            headers=human_headers
        )
        assert rel_human_done.status_code == 200
        assert rel_human_done.json()["status"] == "done"
        assert rel_human_done.json()["done_at"] is not None

        # 5. Reopening release clears done_at
        rel_reopen = ninja_client.patch(
            f"/projects/{test_project.key}/releases/{rel_id}",
            json={"status": "in progress"},
            headers=human_headers
        )
        assert rel_reopen.status_code == 200
        assert rel_reopen.json()["status"] == "in progress"
        assert rel_reopen.json()["done_at"] is None

        # 6. Create sprint (defaults to planned, done_at is None)
        sp_res = ninja_client.post(
            f"/projects/{test_project.key}/sprints",
            json={"name": "Sprint 1", "description": "Iteration 1", "release_id": rel_id},
            headers=human_headers
        )
        assert sp_res.status_code == 200
        sp_data = sp_res.json()
        assert sp_data["status"] == "planned"
        assert sp_data["done_at"] is None
        sp_id = sp_data["id"]

        # 7. MCP cannot mark sprint as done
        sp_mcp_done = ninja_client.patch(
            f"/projects/{test_project.key}/sprints/{sp_id}",
            json={"status": "done"},
            headers=mcp_headers
        )
        assert sp_mcp_done.status_code == 400
        assert "human via the frontend" in sp_mcp_done.json()["detail"]

        # 8. Human marks sprint as done -> records done_at
        sp_human_done = ninja_client.patch(
            f"/projects/{test_project.key}/sprints/{sp_id}",
            json={"status": "done"},
            headers=human_headers
        )
        assert sp_human_done.status_code == 200
        assert sp_human_done.json()["status"] == "done"
        assert sp_human_done.json()["done_at"] is not None

    def test_user_support_tickets_api_and_view_isolation(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key
        headers = {"X-API-Key": raw_key}
        mcp_headers = {"X-API-Key": raw_key, "User-Agent": "Davai-MCP-Client/1.0"}

        # 1. Create a regular work item (DAV-1)
        wi_res = ninja_client.post(
            "/work-items",
            json={"title": "Regular Feature Task", "project_key": test_project.key},
            headers=headers,
        )
        assert wi_res.status_code == 200
        wi_data = wi_res.json()
        assert wi_data["key"] == f"{test_project.key}-1"
        assert wi_data["is_support"] is False

        # 2. Create User Support ticket via /projects/{key}/user-support -> DAV-SUP-1
        sup1_res = ninja_client.post(
            f"/projects/{test_project.key}/user-support",
            json={
                "title": "User cannot download GRIB file",
                "description": "403 error on CDS download endpoint",
                "priority": "HIGH",
                "context": "Investigate token scope",
            },
            headers=headers,
        )
        assert sup1_res.status_code == 200
        sup1 = sup1_res.json()
        assert sup1["key"] == f"{test_project.key}-SUP-1"
        assert sup1["is_support"] is True
        assert sup1["sprint_id"] is None
        assert sup1["release_id"] is None
        assert sup1["context"]["summary"] == "Investigate token scope"

        # 3. Create second User Support ticket via /user-support -> DAV-SUP-2
        sup2_res = ninja_client.post(
            "/user-support",
            json={
                "project_key": test_project.key,
                "title": "API key rotation question",
                "status": "in progress",
            },
            headers=headers,
        )
        assert sup2_res.status_code == 200
        sup2 = sup2_res.json()
        assert sup2["key"] == f"{test_project.key}-SUP-2"
        assert sup2["is_support"] is True
        assert sup2["status"] == "in progress"

        # 4. MCP cannot create or update User Support ticket with status="done"
        mcp_done_res = ninja_client.post(
            "/user-support",
            json={"project_key": test_project.key, "title": "MCP Done", "status": "done"},
            headers=mcp_headers,
        )
        assert mcp_done_res.status_code == 400

        # 5. Strict isolation in list endpoints:
        # GET /work-items only returns regular work items (not DAV-SUP-*)
        reg_list = ninja_client.get(f"/work-items?project_key={test_project.key}", headers=headers).json()
        reg_keys = [i["key"] for i in reg_list]
        assert wi_data["key"] in reg_keys
        assert sup1["key"] not in reg_keys
        assert sup2["key"] not in reg_keys

        # GET /projects/{key}/user-support only returns support tickets (not DAV-1)
        sup_list = ninja_client.get(f"/projects/{test_project.key}/user-support", headers=headers).json()
        sup_keys = [i["key"] for i in sup_list]
        assert sup1["key"] in sup_keys
        assert sup2["key"] in sup_keys
        assert wi_data["key"] not in sup_keys

        # 6. Strict isolation in search endpoints:
        reg_search = ninja_client.get(
            f"/projects/{test_project.key}/search?q=GRIB&mode=keyword", headers=headers
        ).json()
        assert all(r["work_item"]["key"] != sup1["key"] for r in reg_search["results"])

        sup_search = ninja_client.get(
            f"/projects/{test_project.key}/user-support/search?q=GRIB&mode=keyword", headers=headers
        ).json()
        assert [r["work_item"]["key"] for r in sup_search["results"]] == [sup1["key"]]

        # 7. Update User Support ticket via PATCH /user-support/{key}
        patch_res = ninja_client.patch(
            f"/user-support/{sup1['key']}",
            json={"title": "Updated GRIB download issue", "priority": "LOW"},
            headers=headers,
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["title"] == "Updated GRIB download issue"
        assert patch_res.json()["priority"] == "LOW"

        # 8. Delete User Support ticket
        del_res = ninja_client.delete(f"/user-support/{sup2['key']}", headers=headers)
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True










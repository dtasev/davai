import pytest
from starlette.testclient import TestClient
from core.asgi import application

@pytest.mark.django_db(transaction=True)
class TestMCPASGIEndpoints:
    @pytest.fixture(autouse=True)
    def clean_client_context(self):
        from mcp_server.server import set_client
        set_client(None)
        yield
        set_client(None)

    def test_unauthorized_access(self):
        with TestClient(application) as client:
            res = client.post('/mcp/', json={'jsonrpc': '2.0', 'id': 1, 'method': 'initialize'})
            assert res.status_code == 401
            assert "Valid API key required" in res.json()["detail"]

    def test_streamable_http_initialize_with_bearer(self, test_api_key):
        _, raw_key = test_api_key
        headers = {"Authorization": f"Bearer {raw_key}"}
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "antigravity", "version": "1.0"}
            }
        }
        with TestClient(application) as client:
            res = client.post('/mcp/', json=payload, headers=headers)
            assert res.status_code == 200
            assert "jsonrpc" in res.text
            assert "davai-work-tracker" in res.text

    def test_streamable_http_initialize_with_x_api_key(self, test_api_key):
        _, raw_key = test_api_key
        headers = {"X-API-Key": raw_key}
        payload = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "opencode", "version": "1.0"}
            }
        }
        with TestClient(application) as client:
            res = client.post('/mcp/', json=payload, headers=headers)
            assert res.status_code == 200
            assert "jsonrpc" in res.text
            assert "davai-work-tracker" in res.text

    def test_streamable_http_query_param_auth(self, test_api_key):
        _, raw_key = test_api_key
        payload = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "query_auth", "version": "1.0"}
            }
        }
        with TestClient(application) as client:
            # Test ?token= on /mcp?token=... (no trailing slash)
            res = client.post(f'/mcp?token={raw_key}', json=payload)
            assert res.status_code == 200
            assert "jsonrpc" in res.text

            # Test ?token= on /mcp/?token=... (with trailing slash)
            res = client.post(f'/mcp/?token={raw_key}', json=payload)
            assert res.status_code == 200
            assert "jsonrpc" in res.text

            # Test backwards compatibility with ?api_key=
            res = client.post(f'/mcp/?api_key={raw_key}', json=payload)
            assert res.status_code == 200
            assert "jsonrpc" in res.text

    def test_client_context_cleaned_up_after_request(self, test_api_key):
        from mcp_server.server import _client_var
        _, raw_key = test_api_key
        headers = {"Authorization": f"Bearer {raw_key}"}
        payload = {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "1.0"}
            }
        }
        assert _client_var.get() is None
        with TestClient(application) as client:
            res = client.post('/mcp/', json=payload, headers=headers)
            assert res.status_code == 200
        # Context variable should be reset after the request completes
        assert _client_var.get() is None

    @pytest.mark.asyncio
    async def test_contextvar_client_isolation_across_tasks(self):
        import asyncio
        from mcp_server.server import get_client, set_client, reset_client, _client_var
        from mcp_server.client import DavaiClient

        client_a = DavaiClient(api_key="key_user_a")
        client_b = DavaiClient(api_key="key_user_b")

        async def worker_a():
            token = set_client(client_a)
            try:
                await asyncio.sleep(0.02)
                # Verify client inside task A is strictly client A
                assert get_client().api_key == "key_user_a"
            finally:
                reset_client(token)

        async def worker_b():
            token = set_client(client_b)
            try:
                await asyncio.sleep(0.01)
                # Verify client inside task B is strictly client B
                assert get_client().api_key == "key_user_b"
            finally:
                reset_client(token)

        # Run concurrently
        await asyncio.gather(worker_a(), worker_b())
        assert _client_var.get() is None

    def test_concurrent_multi_user_client_isolation(self, test_user, test_api_key):
        from concurrent.futures import ThreadPoolExecutor
        from django.contrib.auth.models import User
        from tracker.auth import generate_api_key
        from mcp_server.server import _client_var

        user_b = User.objects.create(username="user_b", email="b@ecmwf.int")
        _, raw_key_b = generate_api_key(user_b, name="User B Key")
        _, raw_key_a = test_api_key

        payload = {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "multi_user", "version": "1.0"}
            }
        }

        with TestClient(application) as client:
            with ThreadPoolExecutor(max_workers=2) as executor:
                future_a = executor.submit(
                    client.post, '/mcp/', json=payload, headers={"Authorization": f"Bearer {raw_key_a}"}
                )
                future_b = executor.submit(
                    client.post, '/mcp/', json=payload, headers={"Authorization": f"Bearer {raw_key_b}"}
                )
                res_a = future_a.result()
                res_b = future_b.result()

            assert res_a.status_code == 200
            assert res_b.status_code == 200

        # After both finish, outer context has no lingering client
        assert _client_var.get() is None



import pytest
from starlette.testclient import TestClient
from core.asgi import application

@pytest.mark.django_db(transaction=True)
class TestMCPASGIEndpoints:
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
            res = client.post(f'/mcp/?api_key={raw_key}', json=payload)
            assert res.status_code == 200
            assert "jsonrpc" in res.text

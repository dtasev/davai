"""HTTP-layer tests for the GraphQL endpoint's authentication.

The existing tests in test_graphql.py call `schema.execute()` with a
`context_value`, which injects the key straight into the permission class and
never exercises the request handling in tracker/schema.py. These go through the
real ASGI app so header-based acceptance and query-string rejection are covered.
"""

import pytest
from starlette.testclient import TestClient

from core.asgi import application

HELLO = {"query": "{ hello }"}
HELLO_TEXT = "Hello from Strawberry GraphQL!"


@pytest.mark.django_db(transaction=True)
class TestGraphQLHTTPLayer:
    def test_api_key_header_authenticates(self, test_api_key):
        _, raw_key = test_api_key

        with TestClient(application) as client:
            res = client.post("/graphql", json=HELLO, headers={"X-API-Key": raw_key})

        assert res.status_code == 200
        assert res.json().get("errors") is None
        assert res.json()["data"]["hello"] == HELLO_TEXT

    def test_bearer_header_authenticates(self, test_api_key):
        _, raw_key = test_api_key

        with TestClient(application) as client:
            res = client.post("/graphql", json=HELLO, headers={"Authorization": f"Bearer {raw_key}"})

        assert res.status_code == 200
        assert res.json().get("errors") is None
        assert res.json()["data"]["hello"] == HELLO_TEXT

    def test_api_key_in_query_string_is_rejected(self, test_api_key):
        _, raw_key = test_api_key

        with TestClient(application) as client:
            res = client.post("/graphql", json=HELLO, params={"api_key": raw_key})

        body = res.json()
        assert body.get("data") is None
        assert any("Authentication required" in e["message"] for e in body.get("errors", []))

    def test_no_credential_is_rejected(self):
        with TestClient(application) as client:
            res = client.post("/graphql", json=HELLO)

        body = res.json()
        assert body.get("data") is None
        assert any("Authentication required" in e["message"] for e in body.get("errors", []))

    def test_unknown_api_key_is_rejected(self):
        with TestClient(application) as client:
            res = client.post("/graphql", json=HELLO, headers={"X-API-Key": "dav_live_does_not_exist"})

        body = res.json()
        assert body.get("data") is None
        assert any("Authentication required" in e["message"] for e in body.get("errors", []))

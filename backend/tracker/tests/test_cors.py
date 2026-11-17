import pytest


@pytest.mark.django_db
class TestCorsPolicy:
    """
    Middleware-level coverage for the CORS allow-list.

    The API must echo CORS headers only for allow-listed origins and must never
    reflect an arbitrary origin, especially because credentials are allowed.
    """

    ALLOWED = "https://davai-dev.ecmwf.int"
    DISALLOWED = "https://evil.example"

    def test_allowed_origin_is_echoed_with_credentials(self, client):
        response = client.get("/api/hello", HTTP_ORIGIN=self.ALLOWED)

        assert response.status_code == 200
        assert response["Access-Control-Allow-Origin"] == self.ALLOWED
        assert response["Access-Control-Allow-Credentials"] == "true"

    def test_disallowed_origin_gets_no_cors_headers(self, client):
        response = client.get("/api/hello", HTTP_ORIGIN=self.DISALLOWED)

        assert "Access-Control-Allow-Origin" not in response

    def test_preflight_for_allowed_origin(self, client):
        response = client.options(
            "/api/hello",
            HTTP_ORIGIN=self.ALLOWED,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
        )

        assert response["Access-Control-Allow-Origin"] == self.ALLOWED
        assert "GET" in response["Access-Control-Allow-Methods"]

    def test_preflight_for_disallowed_origin_is_not_allowed(self, client):
        response = client.options(
            "/api/hello",
            HTTP_ORIGIN=self.DISALLOWED,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
        )

        assert "Access-Control-Allow-Origin" not in response

    def test_no_origin_header_gets_no_cors_headers(self, client):
        response = client.get("/api/hello")

        assert "Access-Control-Allow-Origin" not in response

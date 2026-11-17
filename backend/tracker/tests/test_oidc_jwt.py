"""Bearer-JWT validation: the issuer and audience must both be enforced.

Without an audience/issuer binding any token the IdP signed for a *different*
client would authenticate here, because the JWKS is realm-wide. These tests sign
real RS256 tokens so the rejection comes from validation, not from a stub.
"""

import time
import types

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from tracker.auth import verify_oidc_jwt

ISSUER = "https://idp.example/auth/realms/ecmwf"
AUDIENCE = "davai"

TRUSTED_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _StubJWKSClient:
    """Serves the realm's public key without a network round-trip."""

    def get_signing_key_from_jwt(self, token):
        return types.SimpleNamespace(key=TRUSTED_KEY.public_key())


@pytest.fixture(autouse=True)
def stub_jwks(monkeypatch):
    from tracker import auth

    monkeypatch.setattr(auth, "get_jwks_client", lambda: _StubJWKSClient())


def _token(private_key=TRUSTED_KEY, drop=(), **overrides):
    now = int(time.time())
    payload = {
        "sub": "1b2c3d",
        "preferred_username": "madt",
        "iat": now,
        "exp": now + 300,
        "iss": ISSUER,
        "aud": AUDIENCE,
    }
    payload.update(overrides)
    for key in drop:
        payload.pop(key, None)
    return jwt.encode(payload, private_key, algorithm="RS256")


@pytest.fixture(autouse=True)
def oidc_settings(settings):
    """pytest-django's settings fixture restores the originals after each test."""
    settings.OIDC_ISSUER_URL = ISSUER
    settings.OIDC_AUDIENCE = AUDIENCE


class TestVerifyOIDCJwt:
    def test_token_from_the_expected_client_is_accepted(self):
        claims = verify_oidc_jwt(_token())

        assert claims is not None
        assert claims["preferred_username"] == "madt"

    def test_token_issued_for_another_audience_is_rejected(self):
        # Same IdP, same signature, but minted for a different client.
        assert verify_oidc_jwt(_token(aud="account")) is None

    def test_token_without_an_audience_claim_is_rejected(self):
        assert verify_oidc_jwt(_token(drop=("aud",))) is None

    def test_token_without_a_subject_is_rejected(self):
        assert verify_oidc_jwt(_token(drop=("sub",))) is None

    def test_token_from_another_issuer_is_rejected(self):
        assert verify_oidc_jwt(_token(iss="https://evil.example/realms/other")) is None

    def test_expired_token_is_rejected(self):
        past = int(time.time()) - 60
        assert verify_oidc_jwt(_token(iat=past, exp=past + 1)) is None

    def test_token_signed_by_another_key_is_rejected(self):
        assert verify_oidc_jwt(_token(private_key=OTHER_KEY)) is None

    def test_garbage_and_empty_input_are_rejected(self):
        assert verify_oidc_jwt("not-a-jwt") is None
        assert verify_oidc_jwt("") is None
        assert verify_oidc_jwt(None) is None

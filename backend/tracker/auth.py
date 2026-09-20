import hashlib
import secrets
from typing import Optional, Tuple
from django.utils import timezone
from django.contrib.auth.models import User
import time
import urllib.request
import urllib.error
import jwt
from jwt import PyJWKClient
from django.conf import settings
from ninja.security import APIKeyHeader, APIKeyQuery, APIKeyCookie, HttpBearer
from tracker.models import APIKey

def hash_key(raw_key: str) -> str:
    """Compute SHA-256 hash of a raw API key token."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

def generate_api_key(user: User, name: str = "API Key") -> Tuple[APIKey, str]:
    """
    Generate a new cryptographically secure API key.
    Returns (APIKey model instance, raw_key_string).
    The raw_key_string is only available once at creation time!
    """
    secret = secrets.token_hex(20)
    raw_key = f"dav_live_{secret}"
    prefix = raw_key[:14]  # e.g. 'dav_live_a1b2'
    key_h = hash_key(raw_key)

    api_key = APIKey.objects.create(
        user=user,
        name=name,
        prefix=prefix,
        key_hash=key_h,
        is_active=True
    )
    return api_key, raw_key

def verify_api_key(raw_key: Optional[str]) -> Optional[User]:
    """
    Verify an API key token. If valid and active, returns the associated User
    and updates last_used_at. Otherwise returns None.
    """
    if not raw_key or not isinstance(raw_key, str):
        return None

    clean_key = raw_key.strip()
    key_h = hash_key(clean_key)

    try:
        api_key = APIKey.objects.select_related("user").filter(
            key_hash=key_h,
            is_active=True
        ).first()

        if api_key:
            # Update last_used_at timestamp without triggering full save signals
            APIKey.objects.filter(id=api_key.id).update(last_used_at=timezone.now())
            return api_key.user
    except Exception:
        return None

    return None

def get_or_create_remote_user(username: str, email: str = "", name: str = "", groups: str = "") -> User:
    """Retrieve or provision a Django User based on Authelia/reverse-proxy remote headers."""
    clean_username = username.strip()
    clean_email = email.strip()
    clean_name = name.strip()
    clean_groups = groups.strip()

    is_staff = "admins" in clean_groups or "dev" in clean_groups or clean_username in ("admin", "root")

    user, created = User.objects.get_or_create(
        username=clean_username,
        defaults={
            "email": clean_email or f"{clean_username}@ecmwf.int",
            "first_name": clean_name or clean_username.capitalize(),
            "is_staff": is_staff,
        }
    )

    if not created:
        updated = False
        if clean_email and user.email != clean_email:
            user.email = clean_email
            updated = True
        if clean_name and user.first_name != clean_name:
            user.first_name = clean_name
            updated = True
        if is_staff and not user.is_staff:
            user.is_staff = True
            updated = True
        if updated:
            user.save(update_fields=["email", "first_name", "is_staff"])

    return user

class ApiKeyHeaderAuth(APIKeyHeader):
    """Authenticates API requests via 'X-API-Key: dav_live_...' header."""
    param_name = "X-API-Key"

    def authenticate(self, request, key: Optional[str]) -> Optional[User]:
        return verify_api_key(key)

class ApiKeyQueryAuth(APIKeyQuery):
    """Authenticates API requests via '?api_key=dav_live_...' query param."""
    param_name = "api_key"

    def authenticate(self, request, key: Optional[str]) -> Optional[User]:
        return verify_api_key(key)

class RemoteUserAuth(APIKeyHeader):
    """
    Authenticates requests forwarded by Authelia / reverse proxy via 'Remote-User' header.
    When present, automatically provisions or retrieves the Django User.
    """
    param_name = "Remote-User"

    def authenticate(self, request, key: Optional[str]) -> Optional[User]:
        username = (key or request.META.get("HTTP_REMOTE_USER") or "").strip()
        if not username:
            return None

        email = request.headers.get("Remote-Email") or request.META.get("HTTP_REMOTE_EMAIL") or ""
        name = request.headers.get("Remote-Name") or request.META.get("HTTP_REMOTE_NAME") or ""
        groups = request.headers.get("Remote-Groups") or request.META.get("HTTP_REMOTE_GROUPS") or ""

        return get_or_create_remote_user(username, email=email, name=name, groups=groups)

# In-memory cache for validated Authelia sessions: session_cookie -> (User, expires_at_timestamp)
_AUTHELIA_SESSION_CACHE = {}

def verify_authelia_session(session_cookie: str, request) -> Optional[User]:
    """
    Validate an authelia_session cookie directly against Authelia's /api/authz/auth-request endpoint.
    Caches verified users for 60 seconds to minimize HTTP round-trips.
    """
    if not session_cookie:
        return None

    now = time.time()
    cached = _AUTHELIA_SESSION_CACHE.get(session_cookie)
    if cached:
        user, expires_at = cached
        if now < expires_at:
            return user
        else:
            _AUTHELIA_SESSION_CACHE.pop(session_cookie, None)

    authelia_url = getattr(settings, "AUTHELIA_AUTH_URL", "http://authelia:9091/api/authz/auth-request")
    try:
        req = urllib.request.Request(
            authelia_url,
            headers={
                "Cookie": f"authelia_session={session_cookie}",
                "X-Original-URL": request.build_absolute_uri(),
                "X-Forwarded-Method": request.method,
            }
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            if resp.status == 200:
                username = resp.headers.get("Remote-User", "").strip()
                if not username:
                    return None
                email = resp.headers.get("Remote-Email", "")
                name = resp.headers.get("Remote-Name", "")
                groups = resp.headers.get("Remote-Groups", "")
                user = get_or_create_remote_user(username, email=email, name=name, groups=groups)
                _AUTHELIA_SESSION_CACHE[session_cookie] = (user, now + 60)
                return user
    except Exception:
        return None

    return None

class AutheliaSessionAuth(APIKeyCookie):
    """
    Authenticates requests carrying an 'authelia_session' cookie.
    Used when reverse-proxy / Ingress forward-auth is not active or as an internal fallback.
    """
    param_name = "authelia_session"

    def authenticate(self, request, key: Optional[str]) -> Optional[User]:
        return verify_authelia_session(key, request)

_JWKS_CLIENT = None

def get_jwks_client() -> PyJWKClient:
    global _JWKS_CLIENT
    if _JWKS_CLIENT is None:
        jwks_url = getattr(settings, "OIDC_JWKS_URL", "")
        _JWKS_CLIENT = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
    return _JWKS_CLIENT

def verify_oidc_jwt(token: str) -> Optional[dict]:
    """
    Validate an OIDC JWT bearer token using cached JWKS public keys.
    Returns decoded token claims if valid, or None.
    """
    if not token or not isinstance(token, str):
        return None

    issuer = getattr(settings, "OIDC_ISSUER_URL", None)
    audience = getattr(settings, "OIDC_AUDIENCE", None)

    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        decode_kwargs = {
            "algorithms": ["RS256", "ES256"],
            "options": {"verify_exp": True},
        }
        if issuer:
            decode_kwargs["issuer"] = issuer
        if audience:
            decode_kwargs["audience"] = audience
        else:
            decode_kwargs["options"]["verify_aud"] = False

        payload = jwt.decode(
            token,
            signing_key.key,
            **decode_kwargs
        )
        return payload
    except Exception:
        return None

class JWTAuth(HttpBearer):
    """
    Authenticates interactive users via 'Authorization: Bearer <jwt>' header issued by OIDC provider.
    Provisions or updates Django user based on standard OIDC claims.
    """
    def authenticate(self, request, token: str) -> Optional[User]:
        claims = verify_oidc_jwt(token)
        if not claims:
            return None

        username = (claims.get("preferred_username") or claims.get("sub") or "").strip()
        if not username:
            return None

        email = claims.get("email") or ""
        name = claims.get("name") or ""
        groups_val = claims.get("groups") or []
        groups_str = ",".join(groups_val) if isinstance(groups_val, list) else str(groups_val)

        return get_or_create_remote_user(username, email=email, name=name, groups=groups_str)

# Composite authenticators: OIDC JWT Bearer, API key in header, query param, Remote-User, or authelia cookie
api_key_auth = [
    JWTAuth(),
    ApiKeyHeaderAuth(),
    ApiKeyQueryAuth(),
    RemoteUserAuth(),
    AutheliaSessionAuth()
]



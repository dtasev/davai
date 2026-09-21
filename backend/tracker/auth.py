import hashlib
import json
import logging
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
from ninja.security import APIKeyHeader, APIKeyQuery, APIKeyCookie, HttpBearer, django_auth
from tracker.models import APIKey

logger = logging.getLogger(__name__)

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

def extract_oidc_user_details(claims: dict) -> Tuple[str, str, str, str]:
    """
    Extract (username, email, name, groups_str) from OIDC claims or userinfo dict.
    Prioritizes human-friendly username fields before falling back to sub UUID.
    """
    email = claims.get("email") or ""
    name = claims.get("name") or claims.get("displayname") or ""
    
    # Candidate username fields in order of human-readability preference:
    # 1. preferred_username (standard OIDC profile claim)
    # 2. nickname
    # 3. email prefix (e.g. 'dimitar' from 'dimitar@ecmwf.int')
    # 4. upn (User Principal Name)
    # 5. name (if single word / username-like)
    # 6. sub (unique subject identifier / UUID fallback)
    username = (
        claims.get("preferred_username")
        or claims.get("nickname")
        or (email.split("@")[0] if email and "@" in email else "")
        or claims.get("upn")
        or (name if name and " " not in name.strip() else "")
        or claims.get("sub")
        or ""
    ).strip()

    groups_val = claims.get("groups") or []
    groups_str = ",".join(groups_val) if isinstance(groups_val, list) else str(groups_val)

    return username, email, name, groups_str

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

try:
    import requests
    from mozilla_django_oidc.auth import OIDCAuthenticationBackend

    class DavaiOIDCAuthenticationBackend(OIDCAuthenticationBackend):
        """
        OIDC authentication backend for mozilla-django-oidc.
        Maps OIDC claims (preferred_username, nickname, email, name, groups) to Django Users.
        """
        def get_userinfo(self, access_token, id_token, payload):
            """
            Extract user details, combining ID token claims with userinfo claims if available.
            """
            claims = dict(payload) if payload else {}
            try:
                user_info = super().get_userinfo(access_token, id_token, payload)
                if isinstance(user_info, dict):
                    claims.update(user_info)
            except Exception as exc:
                logger.warning("OIDC userinfo fetch failed (%s); using ID token payload if available", exc)
                if not claims:
                    raise
            return claims

        def verify_claims(self, claims):
            username, _, _, _ = extract_oidc_user_details(claims)
            return bool(username)

        def filter_users_by_claims(self, claims):
            username, email, name, groups_str = extract_oidc_user_details(claims)
            if not username:
                return self.UserModel.objects.none()
            return self.UserModel.objects.filter(username=username)

        def create_user(self, claims):
            username, email, name, groups_str = extract_oidc_user_details(claims)
            return get_or_create_remote_user(username, email=email, name=name, groups=groups_str)

        def update_user(self, user, claims):
            username, email, name, groups_str = extract_oidc_user_details(claims)
            return get_or_create_remote_user(user.username, email=email, name=name, groups=groups_str)
except ImportError:
    class DavaiOIDCAuthenticationBackend:
        pass

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
    forwarded_host = getattr(settings, "OIDC_FORWARDED_HOST", "davai-dev.ecmwf.int")
    if request:
        try:
            forwarded_host = request.get_host() or forwarded_host
        except Exception:
            pass

    try:
        req = urllib.request.Request(
            authelia_url,
            headers={
                "Cookie": f"authelia_session={session_cookie}",
                "X-Original-URL": request.build_absolute_uri() if request else f"https://{forwarded_host}/",
                "X-Original-Method": request.method if request else "GET",
                "X-Forwarded-Method": request.method if request else "GET",
                "X-Forwarded-Proto": "https",
                "X-Forwarded-Host": forwarded_host,
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

def invalidate_authelia_session(session_cookie: Optional[str], request=None) -> None:
    """
    Invalidate an Authelia session from local cache and call Authelia's logout endpoint if reachable.
    """
    if not session_cookie:
        return

    _AUTHELIA_SESSION_CACHE.pop(session_cookie, None)

    authelia_logout_url = getattr(settings, "AUTHELIA_LOGOUT_URL", "http://authelia:9091/api/logout")
    forwarded_host = getattr(settings, "OIDC_FORWARDED_HOST", "davai-dev.ecmwf.int")
    if request:
        try:
            forwarded_host = request.get_host() or forwarded_host
        except Exception:
            pass

    try:
        req = urllib.request.Request(
            authelia_logout_url,
            data=b"",
            headers={
                "Cookie": f"authelia_session={session_cookie}",
                "X-Forwarded-Proto": "https",
                "X-Forwarded-Host": forwarded_host,
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            pass
    except Exception:
        pass

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
        jwks_url = getattr(settings, "OIDC_JWKS_URL", "http://authelia:9091/authelia/jwks.json")
        headers = {
            "X-Forwarded-Proto": "https",
            "X-Forwarded-Host": getattr(settings, "OIDC_FORWARDED_HOST", "davai-dev.ecmwf.int"),
        }
        _JWKS_CLIENT = PyJWKClient(jwks_url, headers=headers, cache_jwk_set=True, lifespan=3600)
    return _JWKS_CLIENT

def verify_oidc_jwt(token: str) -> Optional[dict]:
    """
    Validate an OIDC JWT bearer token using cached JWKS public keys.
    Returns decoded token claims if valid, or None.
    """
    if not token or not isinstance(token, str):
        return None

    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        decode_kwargs = {
            "algorithms": ["RS256", "ES256"],
            "options": {
                "verify_exp": True,
                "verify_aud": False,
                "verify_iss": False,
            },
        }

        payload = jwt.decode(
            token,
            signing_key.key,
            **decode_kwargs
        )
        return payload
    except Exception:
        return None

_OIDC_USERINFO_CACHE = {}

def fetch_oidc_userinfo(token: str, request=None) -> Optional[dict]:
    """
    Fetch raw userinfo claims dict from Authelia/OIDC userinfo endpoint.
    """
    if not token:
        return None

    userinfo_url = getattr(
        settings,
        "OIDC_USERINFO_URL",
        "http://authelia:9091/authelia/api/oidc/userinfo"
    )
    forwarded_host = getattr(settings, "OIDC_FORWARDED_HOST", "davai-dev.ecmwf.int")
    if request:
        try:
            forwarded_host = request.get_host() or forwarded_host
        except Exception:
            pass

    req_headers = {
        "Authorization": f"Bearer {token}",
        "X-Forwarded-Proto": "https",
        "X-Forwarded-Host": forwarded_host,
    }

    try:
        req = urllib.request.Request(userinfo_url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return data
    except Exception as exc:
        logger.debug("Failed to fetch OIDC userinfo: %s", exc)
        return None

    return None

def verify_oidc_userinfo(token: str, request=None) -> Optional[User]:
    """
    Validate an opaque OIDC access token (e.g. authelia_at_...) via Authelia userinfo endpoint.
    Caches verified users for 60 seconds to minimize HTTP round-trips.
    """
    if not token:
        return None

    now = time.time()
    cached = _OIDC_USERINFO_CACHE.get(token)
    if cached:
        user, expires_at = cached
        if now < expires_at:
            return user
        else:
            _OIDC_USERINFO_CACHE.pop(token, None)

    data = fetch_oidc_userinfo(token, request)
    if not data:
        return None

    logger.info("OIDC userinfo claims received: %s", json.dumps(data, indent=2, default=str))

    username, email, name, groups_str = extract_oidc_user_details(data)
    if not username:
        return None
    user = get_or_create_remote_user(username, email=email, name=name, groups=groups_str)
    _OIDC_USERINFO_CACHE[token] = (user, now + 60)
    return user

class JWTAuth(HttpBearer):
    """
    Authenticates interactive users via 'Authorization: Bearer <token>' header issued by OIDC provider.
    Supports both signed JWT tokens (via JWKS) and opaque tokens (via userinfo endpoint).
    Provisions or updates Django user based on standard OIDC claims.
    """
    def authenticate(self, request, token: str) -> Optional[User]:
        if not token:
            return None

        # 1. Try local cryptographic verification via JWKS (for JWT tokens)
        claims = verify_oidc_jwt(token)
        if claims:
            username, email, name, groups_str = extract_oidc_user_details(claims)
            if username:
                return get_or_create_remote_user(username, email=email, name=name, groups=groups_str)

        # 2. Fallback to OIDC userinfo verification (for opaque tokens or if JWKS fetch missed key)
        user = verify_oidc_userinfo(token, request)
        if user:
            return user

        return None

# Composite authenticators: API key in header, query param, Django session cookie, OIDC JWT, Remote-User, or authelia cookie
api_key_auth = [
    ApiKeyHeaderAuth(),
    ApiKeyQueryAuth(),
    django_auth,
    JWTAuth(),
    RemoteUserAuth(),
    AutheliaSessionAuth()
]



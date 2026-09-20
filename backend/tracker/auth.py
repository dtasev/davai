import hashlib
import secrets
from typing import Optional, Tuple
from django.utils import timezone
from django.contrib.auth.models import User
from ninja.security import APIKeyHeader, APIKeyQuery
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

# Convenient composite authenticator allowing either Header or Query Param
api_key_auth = [ApiKeyHeaderAuth(), ApiKeyQueryAuth()]

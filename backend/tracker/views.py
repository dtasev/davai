import json
import logging
import secrets
import urllib.parse
import urllib.request
import jwt
from django.conf import settings
from django.contrib.auth import login, logout
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect
from tracker.auth import get_or_create_remote_user, verify_oidc_jwt

logger = logging.getLogger(__name__)

def get_redirect_uri(request: HttpRequest) -> str:
    """Determine the OIDC callback URI based on settings or incoming request."""
    if getattr(settings, "OIDC_REDIRECT_URI", ""):
        return settings.OIDC_REDIRECT_URI

    proto = request.headers.get("X-Forwarded-Proto") or ("https" if request.is_secure() else "http")
    host = getattr(settings, "OIDC_FORWARDED_HOST", None) or request.get_host()
    return f"{proto}://{host}/api/auth/oidc/callback"

def oidc_login(request: HttpRequest) -> HttpResponse:
    """Initiate OIDC authorization flow by redirecting the user to the IdP."""
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)

    request.session["oidc_state"] = state
    request.session["oidc_nonce"] = nonce

    # Capture next redirect target if provided
    next_target = request.GET.get("next") or request.GET.get("rd") or "/"
    request.session["oidc_next"] = next_target

    redirect_uri = get_redirect_uri(request)
    auth_endpoint = getattr(
        settings,
        "OIDC_AUTHORIZATION_URL",
        f"{settings.OIDC_ISSUER_URL}/api/oidc/authorization"
    )

    params = {
        "client_id": settings.OIDC_CLIENT_ID,
        "response_type": "code",
        "scope": "openid profile email groups",
        "redirect_uri": redirect_uri,
        "state": state,
        "nonce": nonce,
    }
    auth_url = f"{auth_endpoint}?{urllib.parse.urlencode(params)}"
    return redirect(auth_url)

def oidc_callback(request: HttpRequest) -> HttpResponse:
    """Handle OIDC authorization code callback from the IdP."""
    error = request.GET.get("error")
    if error:
        desc = request.GET.get("error_description") or error
        logger.warning(f"OIDC login error from provider: {desc}")
        return redirect(f"/?auth_error={urllib.parse.quote(desc)}")

    state = request.GET.get("state")
    saved_state = request.session.get("oidc_state")
    if not state or state != saved_state:
        logger.warning(f"OIDC state mismatch: received '{state}', expected '{saved_state}'")
        return redirect("/?auth_error=State+parameter+mismatch")

    code = request.GET.get("code")
    if not code:
        return redirect("/?auth_error=Missing+authorization+code")

    redirect_uri = get_redirect_uri(request)
    token_url = getattr(settings, "OIDC_TOKEN_URL", f"{settings.OIDC_ISSUER_URL}/api/oidc/token")

    # Exchange authorization code for tokens using client credentials
    payload = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": settings.OIDC_CLIENT_ID,
        "client_secret": settings.OIDC_CLIENT_SECRET,
    }).encode("utf-8")

    forwarded_host = getattr(settings, "OIDC_FORWARDED_HOST", "davai-dev.ecmwf.int")
    if request:
        try:
            forwarded_host = request.get_host() or forwarded_host
        except Exception:
            pass

    req_headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Forwarded-Proto": "https",
        "X-Forwarded-Host": forwarded_host,
    }

    try:
        token_req = urllib.request.Request(token_url, data=payload, headers=req_headers)
        with urllib.request.urlopen(token_req, timeout=5.0) as resp:
            if resp.status != 200:
                logger.error(f"Failed to exchange OIDC code for token: HTTP {resp.status}")
                return redirect("/?auth_error=Token+exchange+failed")
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        logger.exception(f"Error during OIDC token exchange: {exc}")
        return redirect("/?auth_error=Token+exchange+exception")

    # Extract user identity:
    id_token = data.get("id_token")
    access_token = data.get("access_token")

    claims = {}
    if id_token:
        claims = verify_oidc_jwt(id_token) or {}
        if not claims:
            try:
                claims = jwt.decode(id_token, options={"verify_signature": False})
            except Exception:
                claims = {}

    username = (claims.get("preferred_username") or claims.get("sub") or "").strip()
    email = claims.get("email") or ""
    name = claims.get("name") or ""
    groups_val = claims.get("groups") or []
    groups_str = ",".join(groups_val) if isinstance(groups_val, list) else str(groups_val)

    if not username and access_token:
        from tracker.auth import verify_oidc_userinfo
        user = verify_oidc_userinfo(access_token, request)
        if user:
            login(request, user)
            next_url = request.session.pop("oidc_next", "/")
            return redirect(next_url)

    if not username:
        logger.error("Could not determine username from OIDC tokens")
        return redirect("/?auth_error=Could+not+identify+user")

    user = get_or_create_remote_user(username, email=email, name=name, groups=groups_str)
    login(request, user)

    # Clean up OIDC session variables
    request.session.pop("oidc_state", None)
    request.session.pop("oidc_nonce", None)

    next_url = request.session.pop("oidc_next", "/")
    return redirect(next_url)

def oidc_logout(request: HttpRequest) -> HttpResponse:
    """Terminate the Django session and redirect to /."""
    logout(request)
    if request.headers.get("Accept") == "application/json" or request.method == "POST":
        return JsonResponse({"ok": True})
    return redirect("/")

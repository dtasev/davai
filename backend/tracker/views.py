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
from tracker.auth import get_or_create_remote_user, verify_oidc_jwt, invalidate_authelia_session, extract_oidc_user_details

logger = logging.getLogger(__name__)

def get_redirect_uri(request: HttpRequest) -> str:
    """Determine the OIDC callback URI based on settings or incoming request."""
    if getattr(settings, "OIDC_REDIRECT_URI", ""):
        return settings.OIDC_REDIRECT_URI

    proto = request.headers.get("X-Forwarded-Proto") or ("https" if request.is_secure() else "http")
    host = request.get_host()
    return f"{proto}://{host}/api/auth/oidc/callback"

def get_authorization_endpoint(request: HttpRequest) -> str:
    """Determine the public authorization URL for browser redirection."""
    auth_endpoint = getattr(settings, "OIDC_AUTHORIZATION_URL", "")
    if auth_endpoint and "authelia:9091" not in auth_endpoint and "0.0.0.0" not in auth_endpoint:
        return auth_endpoint

    proto = request.headers.get("X-Forwarded-Proto") or ("https" if request.is_secure() else "http")
    host = request.get_host()
    return f"{proto}://{host}/authelia/api/oidc/authorization"

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
    auth_endpoint = get_authorization_endpoint(request)

    params = {
        "client_id": settings.OIDC_CLIENT_ID,
        "response_type": "code",
        "scope": "openid profile email groups",
        "redirect_uri": redirect_uri,
        "state": state,
        "nonce": nonce,
    }
    auth_url = f"{auth_endpoint}?{urllib.parse.urlencode(params)}"
    logger.info("Initiating OIDC login redirect to %s (redirect_uri=%s)", auth_endpoint, redirect_uri)
    return redirect(auth_url)

def oidc_callback(request: HttpRequest) -> HttpResponse:
    """Handle OIDC authorization code callback from the IdP."""
    logger.info("OIDC authorization callback received: state=%s", request.GET.get("state"))
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
        logger.warning("OIDC callback received without authorization code")
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

    # Log token endpoint response structure/fields
    token_fields_summary = {
        k: (f"<{k} present ({len(v)} chars)>" if k in ("access_token", "id_token", "refresh_token") and isinstance(v, str) else v)
        for k, v in data.items()
    }
    logger.info("OIDC token endpoint response fields: %s", json.dumps(token_fields_summary, indent=2, default=str))

    # Extract user identity:
    id_token = data.get("id_token")
    access_token = data.get("access_token")

    claims = {}
    if id_token:
        claims = verify_oidc_jwt(id_token) or {}
        if not claims:
            try:
                claims = jwt.decode(id_token, options={"verify_signature": False})
            except Exception as exc:
                logger.warning(f"Could not decode ID token: {exc}")
                claims = {}
        logger.info("OIDC ID token claims received: %s", json.dumps(claims, indent=2, default=str))

    # Also query userinfo if access_token is present to discover any additional profile fields
    userinfo_claims = {}
    if access_token:
        try:
            from tracker.auth import fetch_oidc_userinfo
            raw_userinfo = fetch_oidc_userinfo(access_token, request) or {}
            if raw_userinfo:
                # Exclude mock token leaks if running in test harnesses
                userinfo_claims = {k: v for k, v in raw_userinfo.items() if k not in ("id_token", "access_token", "refresh_token")}
                logger.info("OIDC userinfo endpoint claims received: %s", json.dumps(userinfo_claims, indent=2, default=str))
        except Exception as exc:
            logger.debug(f"Could not fetch OIDC userinfo during callback: {exc}")

    # Combine all fields received from OIDC (ID token claims + userinfo claims)
    all_oidc_fields = {**userinfo_claims, **claims}
    logger.info("OIDC all resolved user fields/claims: %s", json.dumps(all_oidc_fields, indent=2, default=str))

    username, email, name, groups_str = extract_oidc_user_details(all_oidc_fields)

    if not username:
        logger.error("Could not determine username from OIDC tokens. Received fields: %s", json.dumps(all_oidc_fields, default=str))
        return redirect("/?auth_error=Could+not+identify+user")

    user = get_or_create_remote_user(username, email=email, name=name, groups=groups_str)
    login(request, user)

    logger.info(
        "Django successfully logged in user '%s' (id=%s, email='%s', name='%s', is_staff=%s, groups=%s) via OIDC session",
        user.username,
        user.id,
        user.email,
        user.first_name,
        user.is_staff,
        groups_str,
    )

    # Clean up OIDC session variables
    request.session.pop("oidc_state", None)
    request.session.pop("oidc_nonce", None)

    next_url = request.session.pop("oidc_next", "/")
    return redirect(next_url)

def oidc_logout(request: HttpRequest) -> HttpResponse:
    """Terminate the Django session, invalidate Authelia session, and redirect or return ok."""
    authelia_cookie = request.COOKIES.get("authelia_session")
    if authelia_cookie:
        invalidate_authelia_session(authelia_cookie, request)

    logout(request)

    if request.headers.get("Accept") == "application/json" or request.method == "POST":
        response = JsonResponse({"ok": True})
    else:
        response = redirect("/")

    response.delete_cookie("authelia_session", path="/")
    return response

import logging
from django.contrib.auth import logout
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect
from tracker.auth import invalidate_authelia_session

logger = logging.getLogger(__name__)


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

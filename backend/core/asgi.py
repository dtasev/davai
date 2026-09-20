import os
from urllib.parse import parse_qs
from asgiref.sync import sync_to_async
from django.core.asgi import get_asgi_application
from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Scope, Receive, Send
from mcp.server.transport_security import TransportSecuritySettings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django_app = get_asgi_application()

from mcp_server.server import mcp_server, set_client
from mcp_server.client import DavaiClient
from tracker.auth import verify_api_key

# Disable DNS rebinding restriction so requests via Nginx, localhost:6477, and Cloudflare tunnel are accepted
mcp_security = TransportSecuritySettings(
    enable_dns_rebinding_protection=False
)

class MCPAuthMiddleware:
    """
    Middleware that enforces API Key authentication on all MCP endpoints (/mcp/*).
    Accepts keys via:
      1. 'X-API-Key' header
      2. 'Authorization: Bearer <key>' header
      3. '?api_key=<key>' query parameter
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            api_key = None

            # 1. X-API-Key header
            if b"x-api-key" in headers:
                api_key = headers[b"x-api-key"].decode("utf-8", errors="ignore")
            # 2. Authorization: Bearer <key>
            elif b"authorization" in headers:
                auth_val = headers[b"authorization"].decode("utf-8", errors="ignore")
                if auth_val.lower().startswith("bearer "):
                    api_key = auth_val[7:].strip()

            # 3. Query parameter (?api_key=...)
            if not api_key:
                query_string = scope.get("query_string", b"").decode("utf-8", errors="ignore")
                params = parse_qs(query_string)
                if "api_key" in params and params["api_key"]:
                    api_key = params["api_key"][0]

            user = await sync_to_async(verify_api_key)(api_key)

            if not user:
                response = JSONResponse(
                    {
                        "error": "Unauthorized",
                        "detail": "Valid API key required. Provide via 'X-API-Key' header, 'Authorization: Bearer <key>', or '?api_key=<key>' query parameter."
                    },
                    status_code=401
                )
                await response(scope, receive, send)
                return

            # Attach authenticated user to scope and configure API client with the user's API key
            scope["user"] = user
            set_client(DavaiClient(api_key=api_key))

        await self.app(scope, receive, send)

mcp_app = MCPAuthMiddleware(mcp_server.sse_app(transport_security=mcp_security))

routes = [
    Mount('/mcp', app=mcp_app),
    Mount('', app=django_app),
]

application = Starlette(routes=routes)

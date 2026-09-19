import os
from django.core.asgi import get_asgi_application
from starlette.applications import Starlette
from starlette.routing import Mount
from mcp.server.transport_security import TransportSecuritySettings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django_app = get_asgi_application()

from core.mcp import mcp_server

# Disable DNS rebinding restriction so requests via Nginx, localhost:6477, and Cloudflare tunnel are accepted
mcp_security = TransportSecuritySettings(
    enable_dns_rebinding_protection=False
)

# Combined ASGI application routing /mcp to MCP Starlette app and all other traffic to Django
routes = [
    Mount('/mcp', app=mcp_server.sse_app(transport_security=mcp_security)),
    Mount('', app=django_app),
]

application = Starlette(routes=routes)

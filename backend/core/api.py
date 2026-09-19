import sys
from typing import List, Optional
import django
import ninja
from ninja import NinjaAPI, Schema
from core.store import list_items, add_item, update_status, get_item

api = NinjaAPI(
    title="Davai API",
    version="0.1.0",
    description="Cutting-edge, lean Jira-like project tracking engine"
)

class WorkItemSchema(Schema):
    id: str
    key: str
    title: str
    status: str
    priority: str
    assignee: str

class CreateWorkItemSchema(Schema):
    title: str
    priority: str = "MEDIUM"
    assignee: str = "Unassigned"

@api.get("/hello")
def hello(request):
    return {
        "message": "Hello from Django Ninja!",
        "status": "ok",
        "service": "davai-backend"
    }

@api.get("/health")
def health(request):
    return {
        "status": "healthy",
        "database": "connected",
        "mcp": "ready"
    }

@api.get("/info")
def info(request):
    return {
        "python": sys.version.split()[0],
        "django": django.get_version(),
        "ninja": ninja.__version__,
        "database": "sqlite3",
        "ingress_port": 6477,
        "mcp_enabled": True
    }

@api.get("/work-items/preview", response=List[WorkItemSchema])
@api.get("/work-items", response=List[WorkItemSchema])
def get_work_items(request, status: Optional[str] = None):
    return list_items(status)

@api.post("/work-items", response=WorkItemSchema)
def create_work_item(request, payload: CreateWorkItemSchema):
    return add_item(title=payload.title, priority=payload.priority, assignee=payload.assignee)

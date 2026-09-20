import sys
from typing import List, Optional
import django
import ninja
from ninja import NinjaAPI, Schema, errors
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from tracker.models import WorkItem, Project, APIKey
from tracker.auth import api_key_auth, generate_api_key

api = NinjaAPI(
    title="Davai API",
    version="1.0.0",
    description="Cutting-edge, lean Jira-like project tracking engine powered by Django ORM & Django Ninja",
)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserOut(Schema):
    id: int
    username: str
    email: str
    is_staff: bool

class WorkItemOut(Schema):
    id: int
    key: str
    title: str
    description: str
    status: str
    priority: str
    project_key: str
    assignee: str
    reporter: str
    created_at: str
    updated_at: str

    @staticmethod
    def resolve_project_key(obj: WorkItem) -> str:
        return obj.project.key

    @staticmethod
    def resolve_assignee(obj: WorkItem) -> str:
        return obj.assignee.username if obj.assignee else "Unassigned"

    @staticmethod
    def resolve_reporter(obj: WorkItem) -> str:
        return obj.reporter.username if obj.reporter else "System"

    @staticmethod
    def resolve_created_at(obj: WorkItem) -> str:
        return obj.created_at.isoformat()

    @staticmethod
    def resolve_updated_at(obj: WorkItem) -> str:
        return obj.updated_at.isoformat()

class CreateWorkItemIn(Schema):
    title: str
    description: str = ""
    status: str = "TODO"
    priority: str = "MEDIUM"
    project_key: str = "DAV"
    assignee_username: Optional[str] = None

class UpdateWorkItemIn(Schema):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_username: Optional[str] = None

class ProjectOut(Schema):
    id: int
    key: str
    name: str
    description: str
    item_count: int

    @staticmethod
    def resolve_item_count(obj: Project) -> int:
        return obj.items.count()

class CreateProjectIn(Schema):
    key: str
    name: str
    description: str = ""

class APIKeyOut(Schema):
    id: int
    name: str
    prefix: str
    created_at: str
    last_used_at: Optional[str] = None
    is_active: bool

    @staticmethod
    def resolve_created_at(obj: APIKey) -> str:
        return obj.created_at.isoformat()

    @staticmethod
    def resolve_last_used_at(obj: APIKey) -> Optional[str]:
        return obj.last_used_at.isoformat() if obj.last_used_at else None

class CreateAPIKeyIn(Schema):
    name: str = "New API Key"

class CreateAPIKeyOut(Schema):
    id: int
    name: str
    prefix: str
    raw_key: str
    message: str = "Store this API key safely. You will not be able to view it again."

# ---------------------------------------------------------------------------
# Public & System Endpoints
# ---------------------------------------------------------------------------

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
        "orm": "django-6.1",
        "mcp": "ready"
    }

@api.get("/info")
def info(request):
    return {
        "python": sys.version.split()[0],
        "django": django.get_version(),
        "ninja": ninja.__version__,
        "database": "sqlite3_orm",
        "ingress_port": 6477,
        "mcp_enabled": True
    }

# ---------------------------------------------------------------------------
# Authentication & API Key Management
# ---------------------------------------------------------------------------

@api.get("/auth/me", response=UserOut, auth=api_key_auth, summary="Get Current Authenticated User")
def get_current_user(request):
    """Returns details about the user authenticated via the API Key."""
    return request.auth

@api.get("/auth/keys", response=List[APIKeyOut], auth=api_key_auth, summary="List Active API Keys")
def list_user_api_keys(request):
    """List all active API keys belonging to the authenticated user."""
    user = request.auth
    return APIKey.objects.filter(user=user, is_active=True)

@api.post("/auth/keys", response=CreateAPIKeyOut, auth=api_key_auth, summary="Generate New API Key")
def create_user_api_key(request, payload: CreateAPIKeyIn):
    """Generate a new secure API key for the authenticated user."""
    user = request.auth
    api_key_obj, raw_key = generate_api_key(user, name=payload.name)
    return {
        "id": api_key_obj.id,
        "name": api_key_obj.name,
        "prefix": api_key_obj.prefix,
        "raw_key": raw_key,
        "message": "Store this API key safely. You will not be able to view it again."
    }

@api.delete("/auth/keys/{key_id}", auth=api_key_auth, summary="Revoke an API Key")
def revoke_user_api_key(request, key_id: int):
    """Revoke (deactivate) an API key."""
    user = request.auth
    key = get_object_or_404(APIKey, id=key_id, user=user)
    key.is_active = False
    key.save()
    return {"status": "revoked", "key_id": key_id}

# ---------------------------------------------------------------------------
# Project Endpoints
# ---------------------------------------------------------------------------

@api.get("/projects", response=List[ProjectOut], summary="List Projects")
def list_projects(request):
    return Project.objects.all()

@api.post("/projects", response=ProjectOut, auth=api_key_auth, summary="Create Project")
def create_project(request, payload: CreateProjectIn):
    if Project.objects.filter(key=payload.key.upper()).exists():
        raise errors.HttpError(400, f"Project key '{payload.key}' already exists.")
    project = Project.objects.create(
        key=payload.key.upper(),
        name=payload.name,
        description=payload.description
    )
    return project

# ---------------------------------------------------------------------------
# Work Item Endpoints (Django ORM Powered)
# ---------------------------------------------------------------------------

@api.get("/work-items", response=List[WorkItemOut], summary="List Work Items")
@api.get("/work-items/preview", response=List[WorkItemOut], summary="Public Preview of Work Items")
def list_work_items(request, status: Optional[str] = None, project_key: Optional[str] = None):
    qs = WorkItem.objects.select_related("project", "assignee", "reporter").all()
    if status:
        qs = qs.filter(status=status.upper())
    if project_key:
        qs = qs.filter(project__key=project_key.upper())
    return qs

@api.get("/work-items/{key}", response=WorkItemOut, summary="Get Single Work Item")
def get_work_item(request, key: str):
    return get_object_or_404(WorkItem.objects.select_related("project", "assignee", "reporter"), key=key.upper())

@api.post("/work-items", response=WorkItemOut, auth=api_key_auth, summary="Create Work Item")
def create_work_item(request, payload: CreateWorkItemIn):
    user = request.auth
    project = get_object_or_404(Project, key=payload.project_key.upper())

    # Auto-generate next key in sequence e.g. DAV-8
    last_item = WorkItem.objects.filter(project=project).order_by("-id").first()
    next_num = (last_item.id + 1) if last_item else 1
    item_key = f"{project.key}-{next_num}"

    assignee = None
    if payload.assignee_username:
        assignee = User.objects.filter(username=payload.assignee_username).first()

    item = WorkItem.objects.create(
        project=project,
        key=item_key,
        title=payload.title,
        description=payload.description,
        status=payload.status.upper(),
        priority=payload.priority.upper(),
        assignee=assignee,
        reporter=user
    )
    return item

@api.patch("/work-items/{key}", response=WorkItemOut, auth=api_key_auth, summary="Update Work Item")
def update_work_item(request, key: str, payload: UpdateWorkItemIn):
    item = get_object_or_404(WorkItem.objects.select_related("project", "assignee", "reporter"), key=key.upper())

    if payload.title is not None:
        item.title = payload.title
    if payload.description is not None:
        item.description = payload.description
    if payload.status is not None:
        item.status = payload.status.upper()
    if payload.priority is not None:
        item.priority = payload.priority.upper()
    if payload.assignee_username is not None:
        if payload.assignee_username == "":
            item.assignee = None
        else:
            assignee = User.objects.filter(username=payload.assignee_username).first()
            if assignee:
                item.assignee = assignee

    item.save()
    return item

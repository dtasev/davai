import sys
from typing import List, Optional
from datetime import datetime
import django
import ninja
from ninja import NinjaAPI, Schema, errors
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Subquery, OuterRef, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from tracker.models import (
    WorkItem,
    Project,
    ProjectStatus,
    Release,
    Sprint,
    Context,
    Progress,
    APIKey,
)
from tracker.auth import api_key_auth, generate_api_key

api = NinjaAPI(
    title="Davai API",
    version="1.0.0",
    description="Cutting-edge, lean Jira-like project tracking engine powered by Django ORM & Django Ninja",
    # csrf=False,
)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserOut(Schema):
    id: int
    username: str
    email: str
    is_staff: bool


class UserSummaryOut(Schema):
    id: int
    username: str


class ProjectStatusOut(Schema):
    id: int
    name: str
    order: int
    is_default: bool


class ProjectOut(Schema):
    id: int
    key: str
    name: str
    description: str
    item_count: int
    statuses: List[ProjectStatusOut]

    @staticmethod
    def resolve_item_count(obj: Project) -> int:
        return obj.work_items.count()

    @staticmethod
    def resolve_statuses(obj: Project) -> List[ProjectStatusOut]:
        return list(obj.statuses.all())


class CreateProjectIn(Schema):
    key: str
    name: str
    description: str = ""


class ReleaseOut(Schema):
    id: int
    project_key: str
    name: str
    description: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    created_at: str

    @staticmethod
    def resolve_project_key(obj: Release) -> str:
        return obj.project.key

    @staticmethod
    def resolve_start_date(obj: Release) -> Optional[str]:
        return obj.start_date.isoformat() if obj.start_date else None

    @staticmethod
    def resolve_end_date(obj: Release) -> Optional[str]:
        return obj.end_date.isoformat() if obj.end_date else None

    @staticmethod
    def resolve_created_at(obj: Release) -> str:
        return obj.created_at.isoformat()


class CreateReleaseIn(Schema):
    name: str
    description: str = ""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class UpdateReleaseIn(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SprintOut(Schema):
    id: int
    project_key: str
    release_id: Optional[int] = None
    name: str
    description: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    created_at: str

    @staticmethod
    def resolve_project_key(obj: Sprint) -> str:
        return obj.project.key

    @staticmethod
    def resolve_release_id(obj: Sprint) -> Optional[int]:
        return obj.release_id

    @staticmethod
    def resolve_start_date(obj: Sprint) -> Optional[str]:
        return obj.start_date.isoformat() if obj.start_date else None

    @staticmethod
    def resolve_end_date(obj: Sprint) -> Optional[str]:
        return obj.end_date.isoformat() if obj.end_date else None

    @staticmethod
    def resolve_created_at(obj: Sprint) -> str:
        return obj.created_at.isoformat()


class CreateSprintIn(Schema):
    name: str
    description: str = ""
    release_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class UpdateSprintIn(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    release_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ContextOut(Schema):
    id: int
    work_item_key: str
    user: Optional[str] = None
    updated_by: Optional[str] = None
    summary: str
    timestamp: str

    @staticmethod
    def resolve_work_item_key(obj: Context) -> str:
        return obj.work_item.key

    @staticmethod
    def resolve_user(obj: Context) -> Optional[str]:
        return obj.user.username if obj.user else None

    @staticmethod
    def resolve_updated_by(obj: Context) -> Optional[str]:
        return obj.user.username if obj.user else None

    @staticmethod
    def resolve_timestamp(obj: Context) -> str:
        return obj.timestamp.isoformat()


class UpdateContextIn(Schema):
    summary: str


class ProgressOut(Schema):
    id: int
    work_item_key: str
    created_by: Optional[str] = None
    summary: str
    proof: str
    status: str
    created_at: str
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None

    @staticmethod
    def resolve_work_item_key(obj: Progress) -> str:
        return obj.work_item.key

    @staticmethod
    def resolve_created_by(obj: Progress) -> Optional[str]:
        return obj.created_by.username if obj.created_by else None

    @staticmethod
    def resolve_created_at(obj: Progress) -> str:
        return obj.created_at.isoformat()

    @staticmethod
    def resolve_updated_at(obj: Progress) -> Optional[str]:
        return obj.updated_at.isoformat() if obj.updated_at else None

    @staticmethod
    def resolve_updated_by(obj: Progress) -> Optional[str]:
        return obj.updated_by.username if obj.updated_by else None


class CreateProgressIn(Schema):
    summary: str
    proof: str = ""
    status: str = "step completed"


class UpdateProgressIn(Schema):
    summary: Optional[str] = None
    proof: Optional[str] = None
    status: Optional[str] = None


class WorkItemOut(Schema):
    id: int
    key: str
    parent_key: Optional[str] = None
    title: str
    description: str
    status: str
    priority: str
    project_key: str
    active_assignee: Optional[str] = None
    created_by: str
    updated_by: Optional[str] = None
    assigned: List[str]
    watching: List[str]
    source: str
    start_date: Optional[str] = None
    target_date: Optional[str] = None
    sprint_id: Optional[int] = None
    release_id: Optional[int] = None
    created: str
    updated: str
    context: Optional[ContextOut] = None
    progress: List[ProgressOut]

    @staticmethod
    def resolve_parent_key(obj: WorkItem) -> Optional[str]:
        return obj.parent.key if obj.parent else None

    @staticmethod
    def resolve_status(obj: WorkItem) -> str:
        return obj.status

    @staticmethod
    def resolve_project_key(obj: WorkItem) -> str:
        return obj.project.key

    @staticmethod
    def resolve_active_assignee(obj: WorkItem) -> Optional[str]:
        return obj.active_assignee.username if obj.active_assignee else None

    @staticmethod
    def resolve_created_by(obj: WorkItem) -> str:
        return obj.created_by.username if obj.created_by else "System"

    @staticmethod
    def resolve_updated_by(obj: WorkItem) -> Optional[str]:
        return obj.updated_by.username if obj.updated_by else None

    @staticmethod
    def resolve_assigned(obj: WorkItem) -> List[str]:
        return [u.username for u in obj.assigned.all()]

    @staticmethod
    def resolve_watching(obj: WorkItem) -> List[str]:
        return [u.username for u in obj.watching.all()]

    @staticmethod
    def resolve_start_date(obj: WorkItem) -> Optional[str]:
        return obj.start_date.isoformat() if obj.start_date else None

    @staticmethod
    def resolve_target_date(obj: WorkItem) -> Optional[str]:
        return obj.target_date.isoformat() if obj.target_date else None

    @staticmethod
    def resolve_created(obj: WorkItem) -> str:
        return obj.created.isoformat()

    @staticmethod
    def resolve_updated(obj: WorkItem) -> str:
        return obj.updated.isoformat()

    @staticmethod
    def resolve_context(obj: WorkItem) -> Optional[Context]:
        return getattr(obj, "context", None)

    @staticmethod
    def resolve_progress(obj: WorkItem) -> List[Progress]:
        return list(obj.progress.all())


class CreateWorkItemIn(Schema):
    title: str
    description: str = ""
    project_key: str = "DAV"
    parent_key: Optional[str] = None
    status: Optional[str] = None
    priority: str = "MEDIUM"
    active_assignee_username: Optional[str] = None
    source: str = ""
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    sprint_id: Optional[int] = None
    release_id: Optional[int] = None
    context: Optional[str] = None


class UpdateWorkItemIn(Schema):
    title: Optional[str] = None
    description: Optional[str] = None
    parent_key: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    active_assignee_username: Optional[str] = None
    source: Optional[str] = None
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    sprint_id: Optional[int] = None
    release_id: Optional[int] = None


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
    return request.auth


@api.get("/auth/keys", response=List[APIKeyOut], auth=api_key_auth, summary="List Active API Keys")
def list_user_api_keys(request):
    user = request.auth
    return APIKey.objects.filter(user=user, is_active=True)


@api.post("/auth/keys", response=CreateAPIKeyOut, auth=api_key_auth, summary="Generate New API Key")
def create_user_api_key(request, payload: CreateAPIKeyIn):
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
    user = request.auth
    key = get_object_or_404(APIKey, id=key_id, user=user)
    key.is_active = False
    key.save()
    return {"status": "revoked", "key_id": key_id}


# ---------------------------------------------------------------------------
# User Endpoints
# ---------------------------------------------------------------------------

@api.get("/users", response=List[UserSummaryOut], summary="List Assignable Users")
def list_users(request, project: Optional[str] = None, project_key: Optional[str] = None):
    # 'project' and 'project_key' arguments are accepted for future project-level assignee scoping,
    # but currently unused - all projects see all users as assignees.
    return User.objects.only("id", "username").order_by("username").all()


# ---------------------------------------------------------------------------
# Project Endpoints
# ---------------------------------------------------------------------------

@api.get("/projects", response=List[ProjectOut], summary="List Projects")
def list_projects(request):
    return Project.objects.prefetch_related("statuses", "work_items").all()


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


@api.get("/projects/{project_key}/statuses", response=List[ProjectStatusOut], summary="List Project Statuses")
def list_project_statuses(request, project_key: str):
    project = get_object_or_404(Project, key=project_key.upper())
    return project.statuses.all()


# ---------------------------------------------------------------------------
# Sprint & Release Endpoints
# ---------------------------------------------------------------------------

@api.get("/projects/{project_key}/releases", response=List[ReleaseOut], summary="List Releases")
def list_releases(request, project_key: str):
    project = get_object_or_404(Project, key=project_key.upper())
    return project.releases.all()


@api.post("/projects/{project_key}/releases", response=ReleaseOut, auth=api_key_auth, summary="Create Release")
def create_release(request, project_key: str, payload: CreateReleaseIn):
    project = get_object_or_404(Project, key=project_key.upper())
    return Release.objects.create(
        project=project,
        name=payload.name,
        description=payload.description,
        start_date=payload.start_date,
        end_date=payload.end_date
    )


@api.patch("/projects/{project_key}/releases/{release_id}", response=ReleaseOut, auth=api_key_auth, summary="Update Release")
def update_release(request, project_key: str, release_id: int, payload: UpdateReleaseIn):
    project = get_object_or_404(Project, key=project_key.upper())
    release = get_object_or_404(Release, id=release_id, project=project)
    if payload.name is not None:
        release.name = payload.name
    if payload.description is not None:
        release.description = payload.description
    if "start_date" in payload.model_fields_set:
        release.start_date = payload.start_date
    if "end_date" in payload.model_fields_set:
        release.end_date = payload.end_date
    release.save()
    return release


@api.delete("/projects/{project_key}/releases/{release_id}", auth=api_key_auth, summary="Delete Release")
def delete_release(request, project_key: str, release_id: int):
    project = get_object_or_404(Project, key=project_key.upper())
    release = get_object_or_404(Release, id=release_id, project=project)
    release.delete()
    return {"success": True, "message": f"Release {release_id} deleted"}


@api.get("/projects/{project_key}/sprints", response=List[SprintOut], summary="List Sprints")
def list_sprints(request, project_key: str):
    project = get_object_or_404(Project, key=project_key.upper())
    return project.sprints.all()


@api.post("/projects/{project_key}/sprints", response=SprintOut, auth=api_key_auth, summary="Create Sprint")
def create_sprint(request, project_key: str, payload: CreateSprintIn):
    project = get_object_or_404(Project, key=project_key.upper())
    release = None
    if payload.release_id:
        release = get_object_or_404(Release, id=payload.release_id, project=project)

    return Sprint.objects.create(
        project=project,
        release=release,
        name=payload.name,
        description=payload.description,
        start_date=payload.start_date,
        end_date=payload.end_date
    )


@api.patch("/projects/{project_key}/sprints/{sprint_id}", response=SprintOut, auth=api_key_auth, summary="Update Sprint")
def update_sprint(request, project_key: str, sprint_id: int, payload: UpdateSprintIn):
    project = get_object_or_404(Project, key=project_key.upper())
    sprint = get_object_or_404(Sprint, id=sprint_id, project=project)
    if payload.name is not None:
        sprint.name = payload.name
    if payload.description is not None:
        sprint.description = payload.description
    if payload.release_id is not None:
        if payload.release_id == 0:
            sprint.release = None
        else:
            sprint.release = get_object_or_404(Release, id=payload.release_id, project=project)
    if "start_date" in payload.model_fields_set:
        sprint.start_date = payload.start_date
    if "end_date" in payload.model_fields_set:
        sprint.end_date = payload.end_date
    sprint.save()
    return sprint


@api.delete("/projects/{project_key}/sprints/{sprint_id}", auth=api_key_auth, summary="Delete Sprint")
def delete_sprint(request, project_key: str, sprint_id: int):
    project = get_object_or_404(Project, key=project_key.upper())
    sprint = get_object_or_404(Sprint, id=sprint_id, project=project)
    sprint.delete()
    return {"success": True, "message": f"Sprint {sprint_id} deleted"}


# ---------------------------------------------------------------------------
# Work Item Endpoints
# ---------------------------------------------------------------------------

def _resolve_status(project: Project, status_val: Optional[str]) -> Optional[ProjectStatus]:
    if not status_val:
        return project.get_default_status()
    normalized = status_val.strip()
    status_obj = project.statuses.filter(name__iexact=normalized.replace("_", " ")).first()
    if not status_obj:
        status_obj = project.statuses.filter(name__iexact=normalized).first()
    if not status_obj:
        status_obj = project.get_default_status()
    return status_obj


@api.get("/work-items", response=List[WorkItemOut], summary="List Work Items")
@api.get("/work-items/preview", response=List[WorkItemOut], summary="Public Preview of Work Items", operation_id="tracker_api_list_work_items_preview")
def list_work_items(request, status: Optional[str] = None, project_key: Optional[str] = None):
    qs = WorkItem.objects.select_related(
        "project", "parent", "active_assignee", "created_by", "updated_by", "sprint", "release", "context"
    ).prefetch_related("assigned", "watching", "progress__created_by", "progress__updated_by").all()

    if status:
        normalized = status.strip().lower().replace("_", " ")
        latest_status_subquery = Subquery(
            Progress.objects.filter(work_item=OuterRef("pk")).order_by("-created_at", "-id").values("status")[:1]
        )
        qs = qs.annotate(
            latest_status=Coalesce(latest_status_subquery, Value("todo"))
        ).filter(latest_status__iexact=normalized)
    if project_key:
        qs = qs.filter(project__key=project_key.upper())
    return qs


@api.get("/work-items/{key}", response=WorkItemOut, summary="Get Single Work Item")
def get_work_item(request, key: str):
    return get_object_or_404(
        WorkItem.objects.select_related(
            "project", "parent", "active_assignee", "created_by", "updated_by", "sprint", "release", "context"
        ).prefetch_related("assigned", "watching", "progress__created_by", "progress__updated_by"),
        key=key.upper()
    )


@api.post("/work-items", response=WorkItemOut, auth=api_key_auth, summary="Create Work Item")
def create_work_item(request, payload: CreateWorkItemIn):
    user = request.auth
    project = get_object_or_404(Project, key=payload.project_key.upper())

    last_item = WorkItem.objects.filter(project=project).order_by("-id").first()
    next_num = (last_item.id + 1) if last_item else 1
    item_key = f"{project.key}-{next_num}"

    parent = None
    if payload.parent_key:
        parent = WorkItem.objects.filter(key=payload.parent_key.upper()).first()

    assignee = None
    if "active_assignee_username" in payload.model_fields_set:
        if payload.active_assignee_username:
            assignee = User.objects.filter(username=payload.active_assignee_username).first()
        else:
            assignee = None
    else:
        assignee = user

    sprint = None
    if payload.sprint_id:
        sprint = Sprint.objects.filter(id=payload.sprint_id, project=project).first()

    release = None
    if payload.release_id:
        release = Release.objects.filter(id=payload.release_id, project=project).first()

    clean_status = payload.status.strip().lower() if payload.status else None
    if clean_status == "done":
        user_agent = request.headers.get("User-Agent", "")
        if "Davai-MCP" in user_agent:
            raise errors.HttpError(400, "The 'done' status can only be set by a human via the frontend, not via MCP.")

    with transaction.atomic():
        item = WorkItem.objects.create(
            project=project,
            parent=parent,
            key=item_key,
            title=payload.title,
            description=payload.description,
            priority=payload.priority.upper(),
            active_assignee=assignee,
            created_by=user,
            source=payload.source,
            start_date=payload.start_date,
            target_date=payload.target_date,
            sprint=sprint,
            release=release
        )
        if clean_status and clean_status != "todo":
            Progress.objects.create(
                work_item=item,
                created_by=user,
                summary=f"Initial status set to {clean_status}",
                status=clean_status
            )
        if payload.context:
            context_obj = Context.objects.create(work_item=item, user=user, summary=payload.context)
            item.context = context_obj
    return item


@api.patch("/work-items/{key}", response=WorkItemOut, auth=api_key_auth, summary="Update Work Item")
def update_work_item(request, key: str, payload: UpdateWorkItemIn):
    item = get_object_or_404(
        WorkItem.objects.select_related("project", "active_assignee", "created_by"),
        key=key.upper()
    )
    user = request.auth

    if payload.title is not None:
        item.title = payload.title
    if payload.description is not None:
        item.description = payload.description
    if payload.parent_key is not None:
        if payload.parent_key == "":
            item.parent = None
        else:
            item.parent = WorkItem.objects.filter(key=payload.parent_key.upper()).first()
    if payload.status is not None:
        clean_status = payload.status.strip().lower()
        if clean_status == "done":
            user_agent = request.headers.get("User-Agent", "")
            if "Davai-MCP" in user_agent:
                raise errors.HttpError(400, "The 'done' status can only be set by a human via the frontend, not via MCP.")
        Progress.objects.create(
            work_item=item,
            created_by=user,
            summary=f"Status updated to {clean_status}",
            status=clean_status
        )
    if payload.priority is not None:
        item.priority = payload.priority.upper()
    if "active_assignee_username" in payload.model_fields_set:
        if not payload.active_assignee_username:
            item.active_assignee = None
        else:
            assignee = User.objects.filter(username=payload.active_assignee_username).first()
            if assignee:
                item.active_assignee = assignee
    if payload.source is not None:
        item.source = payload.source
    if "start_date" in payload.model_fields_set:
        item.start_date = payload.start_date
    if "target_date" in payload.model_fields_set:
        item.target_date = payload.target_date
    if payload.sprint_id is not None:
        if payload.sprint_id == 0:
            item.sprint = None
        else:
            item.sprint = Sprint.objects.filter(id=payload.sprint_id, project=item.project).first()
    if payload.release_id is not None:
        if payload.release_id == 0:
            item.release = None
        else:
            item.release = Release.objects.filter(id=payload.release_id, project=item.project).first()

    item.updated_by = user
    item.save()
    return item


@api.delete("/work-items/{key}", auth=api_key_auth, summary="Delete Work Item")
def delete_work_item(request, key: str):
    item = get_object_or_404(WorkItem, key=key.upper())
    item.delete()
    return {"success": True, "message": f"Work item {key.upper()} deleted"}


# ---------------------------------------------------------------------------
# Context & Progress Endpoints (LLM Agent Assistance)
# ---------------------------------------------------------------------------

@api.get("/work-items/{key}/context", response=ContextOut, summary="Get Work Item Context")
def get_work_item_context(request, key: str):
    item = get_object_or_404(WorkItem, key=key.upper())
    context = getattr(item, "context", None)
    if not context:
        raise errors.HttpError(404, f"No context documented yet for {item.key}")
    return context


@api.put("/work-items/{key}/context", response=ContextOut, auth=api_key_auth, summary="Update Work Item Context")
def update_work_item_context(request, key: str, payload: UpdateContextIn):
    """
    Set or overwrite the unversioned, SKILL.md-style markdown technical context for the work item.
    Replaces previous context completely (unversioned, latest facts only).
    """
    user = request.auth
    item = get_object_or_404(WorkItem, key=key.upper())
    context, _ = Context.objects.get_or_create(work_item=item)
    context.summary = payload.summary
    context.user = user
    context.save()
    return context


@api.get("/work-items/{key}/progress", response=List[ProgressOut], summary="List Work Item Progress Entries")
def list_work_item_progress(request, key: str):
    item = get_object_or_404(WorkItem, key=key.upper())
    return item.progress.select_related("created_by", "updated_by").all()


@api.post("/work-items/{key}/progress", response=ProgressOut, auth=api_key_auth, summary="Log Progress Entry")
def log_work_item_progress(request, key: str, payload: CreateProgressIn):
    """
    Log a milestone or progress entry. If work is version controlled, proof should be a git sha or branch name.
    """
    user = request.auth
    item = get_object_or_404(WorkItem, key=key.upper())
    clean_status = (payload.status or "step completed").strip().lower()
    if clean_status == "done":
        user_agent = request.headers.get("User-Agent", "")
        if "Davai-MCP" in user_agent:
            raise errors.HttpError(400, "The 'done' status can only be set by a human via the frontend, not via MCP.")
    return Progress.objects.create(
        work_item=item,
        created_by=user,
        summary=payload.summary,
        proof=payload.proof,
        status=clean_status
    )


@api.patch("/work-items/{key}/progress/{progress_id}", response=ProgressOut, auth=api_key_auth, summary="Update Progress Entry")
def update_work_item_progress(request, key: str, progress_id: int, payload: UpdateProgressIn):
    """
    Update an existing progress entry (e.g. to fix a typo or update proof/status).
    Enforces ownership permissions: only staff or creator may edit.
    """
    user = request.auth
    item = get_object_or_404(WorkItem, key=key.upper())
    progress = get_object_or_404(
        Progress.objects.select_related("created_by", "updated_by"),
        id=progress_id,
        work_item=item
    )

    if not user.is_staff and progress.created_by and progress.created_by != user:
        raise errors.HttpError(403, "You do not have permission to edit this progress entry")

    if payload.summary is not None:
        progress.summary = payload.summary
    if payload.proof is not None:
        progress.proof = payload.proof
    if payload.status is not None:
        clean_status = payload.status.strip().lower()
        if clean_status == "done":
            user_agent = request.headers.get("User-Agent", "")
            if "Davai-MCP" in user_agent:
                raise errors.HttpError(400, "The 'done' status can only be set by a human via the frontend, not via MCP.")
        progress.status = clean_status

    progress.updated_by = user
    progress.save()
    return progress


@api.delete("/work-items/{key}/progress/{progress_id}", auth=api_key_auth, summary="Delete Progress Entry")
def delete_work_item_progress(request, key: str, progress_id: int):
    """
    Delete an existing progress entry.
    Enforces ownership permissions: only staff or creator may delete.
    """
    user = request.auth
    item = get_object_or_404(WorkItem, key=key.upper())
    progress = get_object_or_404(Progress, id=progress_id, work_item=item)

    if not user.is_staff and progress.created_by and progress.created_by != user:
        raise errors.HttpError(403, "You do not have permission to delete this progress entry")

    progress.delete()
    return {"success": True, "message": f"Progress entry {progress_id} deleted"}

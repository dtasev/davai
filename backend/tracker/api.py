import sys
import logging
from typing import List, Optional, Any
from datetime import datetime
import django
import ninja
from ninja import NinjaAPI, Schema, errors
from django.contrib.auth.models import User
from django.db import transaction, connection
from django.db.models import Subquery, OuterRef, Value, Q
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from tracker.models import (
    WorkItem,
    Project,
    ProjectStatus,
    Release,
    Sprint,
    Context,
    Progress,
    APIKey,
    WorkItemEmbedding,
    Incident,
    IncidentEmbedding,
    MonitoringLog,
    ALL_PROGRESS_STATUSES,
    INCIDENT_STATUSES,
    HUMAN_ONLY_INCIDENT_STATUSES,
    MONITORING_LOG_STATUSES,
    SPRINT_RELEASE_STATUSES,
    HUMAN_ONLY_SPRINT_RELEASE_STATUSES,
)
from tracker.auth import api_key_auth, generate_api_key

logger = logging.getLogger(__name__)

api = NinjaAPI(
    title="Davai API",
    version="1.0.0",
    description="Cutting-edge, lean Jira-like project tracking engine powered by Django ORM & Django Ninja",
    auth=api_key_auth,
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
        if hasattr(obj, "_prefetched_objects_cache") and "work_items" in obj._prefetched_objects_cache:
            return sum(1 for w in obj.work_items.all() if not w.is_support)
        return obj.work_items.filter(is_support=False).count()

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
    status: str = "planned"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    done_at: Optional[str] = None
    created_at: str

    @staticmethod
    def resolve_project_key(obj: Release) -> str:
        return obj.project.key

    @staticmethod
    def resolve_status(obj: Release) -> str:
        return obj.status or "planned"

    @staticmethod
    def resolve_start_date(obj: Release) -> Optional[str]:
        return obj.start_date.isoformat() if obj.start_date else None

    @staticmethod
    def resolve_end_date(obj: Release) -> Optional[str]:
        return obj.end_date.isoformat() if obj.end_date else None

    @staticmethod
    def resolve_done_at(obj: Release) -> Optional[str]:
        return obj.done_at.isoformat() if obj.done_at else None

    @staticmethod
    def resolve_created_at(obj: Release) -> str:
        return obj.created_at.isoformat()


class CreateReleaseIn(Schema):
    name: str
    description: str = ""
    status: Optional[str] = "planned"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class UpdateReleaseIn(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SprintOut(Schema):
    id: int
    project_key: str
    release_id: Optional[int] = None
    name: str
    description: str
    status: str = "planned"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    done_at: Optional[str] = None
    created_at: str

    @staticmethod
    def resolve_project_key(obj: Sprint) -> str:
        return obj.project.key

    @staticmethod
    def resolve_release_id(obj: Sprint) -> Optional[int]:
        return obj.release_id

    @staticmethod
    def resolve_status(obj: Sprint) -> str:
        return obj.status or "planned"

    @staticmethod
    def resolve_start_date(obj: Sprint) -> Optional[str]:
        return obj.start_date.isoformat() if obj.start_date else None

    @staticmethod
    def resolve_end_date(obj: Sprint) -> Optional[str]:
        return obj.end_date.isoformat() if obj.end_date else None

    @staticmethod
    def resolve_done_at(obj: Sprint) -> Optional[str]:
        return obj.done_at.isoformat() if obj.done_at else None

    @staticmethod
    def resolve_created_at(obj: Sprint) -> str:
        return obj.created_at.isoformat()


class CreateSprintIn(Schema):
    name: str
    description: str = ""
    status: Optional[str] = "planned"
    release_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class UpdateSprintIn(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
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
    status: str = "in progress"


class UpdateProgressIn(Schema):
    summary: Optional[str] = None
    proof: Optional[str] = None
    status: Optional[str] = None


class SubtaskSummaryOut(Schema):
    key: str
    title: str


class WorkItemListOut(Schema):
    id: int
    key: str
    is_support: bool = False
    parent_key: Optional[str] = None
    title: str
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
    subtasks: List[SubtaskSummaryOut] = []

    @staticmethod
    def resolve_is_support(obj: WorkItem) -> bool:
        return bool(obj.is_support)

    @staticmethod
    def resolve_subtasks(obj: WorkItem) -> List[SubtaskSummaryOut]:
        return [SubtaskSummaryOut(key=s.key, title=s.title) for s in obj.subtasks.all()]

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


class WorkItemOut(WorkItemListOut):
    description: str
    context: Optional[ContextOut] = None
    progress: List[ProgressOut]

    @staticmethod
    def resolve_context(obj: WorkItem) -> Optional[Context]:
        return getattr(obj, "context", None)

    @staticmethod
    def resolve_progress(obj: WorkItem) -> List[Progress]:
        return list(obj.progress.all())


class SearchItemResultOut(Schema):
    work_item: WorkItemOut
    score: float
    vector_distance: Optional[float] = None
    rank_vector: Optional[int] = None
    rank_keyword: Optional[int] = None
    match_type: str
    snippet: str


class SearchResponseOut(Schema):
    query: str
    mode: str
    total: int
    results: List[SearchItemResultOut]


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
    is_support: bool = False


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


class CreateUserSupportIn(Schema):
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
    context: Optional[str] = None


class UpdateUserSupportIn(Schema):
    title: Optional[str] = None
    description: Optional[str] = None
    parent_key: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    active_assignee_username: Optional[str] = None
    source: Optional[str] = None
    start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None


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

@api.get("/hello", auth=None)
def hello(request):
    return {
        "message": "Hello from Django Ninja!",
        "status": "ok",
        "service": "davai-backend"
    }


@api.get("/health", auth=None)
def health(request):
    return {
        "status": "healthy",
        "database": "connected",
        "orm": "django-6.1",
        "mcp": "ready"
    }


@api.get("/info", auth=None)
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

def _validate_and_normalize_sprint_release_status(request, raw_status: Optional[str], default: str = "planned") -> str:
    if not raw_status:
        return default
    clean_status = raw_status.strip().lower().replace("_", " ")
    if clean_status not in SPRINT_RELEASE_STATUSES:
        raise errors.HttpError(
            400,
            f"Invalid status '{raw_status}'. Allowed statuses are: {', '.join(SPRINT_RELEASE_STATUSES)}."
        )
    if clean_status in HUMAN_ONLY_SPRINT_RELEASE_STATUSES:
        user_agent = request.headers.get("User-Agent", "")
        if "Davai-MCP" in user_agent:
            raise errors.HttpError(
                400,
                f"The '{clean_status}' status can only be set by a human via the frontend, not via MCP."
            )
    return clean_status


@api.get("/projects/{project_key}/releases", response=List[ReleaseOut], summary="List Releases")
def list_releases(request, project_key: str):
    project = get_object_or_404(Project, key=project_key.upper())
    return project.releases.all()


@api.post("/projects/{project_key}/releases", response=ReleaseOut, auth=api_key_auth, summary="Create Release")
def create_release(request, project_key: str, payload: CreateReleaseIn):
    project = get_object_or_404(Project, key=project_key.upper())
    clean_status = _validate_and_normalize_sprint_release_status(request, payload.status, default="planned")
    return Release.objects.create(
        project=project,
        name=payload.name,
        description=payload.description,
        status=clean_status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        done_at=timezone.now() if clean_status == "done" else None,
    )


@api.patch("/projects/{project_key}/releases/{release_id}", response=ReleaseOut, auth=api_key_auth, summary="Update Release")
def update_release(request, project_key: str, release_id: int, payload: UpdateReleaseIn):
    project = get_object_or_404(Project, key=project_key.upper())
    release = get_object_or_404(Release, id=release_id, project=project)
    if payload.name is not None:
        release.name = payload.name
    if payload.description is not None:
        release.description = payload.description
    if payload.status is not None:
        clean_status = _validate_and_normalize_sprint_release_status(request, payload.status)
        if clean_status == "done":
            if release.status != "done" or not release.done_at:
                release.done_at = timezone.now()
        else:
            release.done_at = None
        release.status = clean_status
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
    clean_status = _validate_and_normalize_sprint_release_status(request, payload.status, default="planned")

    return Sprint.objects.create(
        project=project,
        release=release,
        name=payload.name,
        description=payload.description,
        status=clean_status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        done_at=timezone.now() if clean_status == "done" else None,
    )


@api.patch("/projects/{project_key}/sprints/{sprint_id}", response=SprintOut, auth=api_key_auth, summary="Update Sprint")
def update_sprint(request, project_key: str, sprint_id: int, payload: UpdateSprintIn):
    project = get_object_or_404(Project, key=project_key.upper())
    sprint = get_object_or_404(Sprint, id=sprint_id, project=project)
    if payload.name is not None:
        sprint.name = payload.name
    if payload.description is not None:
        sprint.description = payload.description
    if payload.status is not None:
        clean_status = _validate_and_normalize_sprint_release_status(request, payload.status)
        if clean_status == "done":
            if sprint.status != "done" or not sprint.done_at:
                sprint.done_at = timezone.now()
        else:
            sprint.done_at = None
        sprint.status = clean_status
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


def _extract_snippet(item: WorkItem, query: str) -> str:
    """Extracts a short contextual snippet matching the query or item summary."""
    q_lower = query.lower().strip()
    if not q_lower:
        return item.title

    if q_lower in item.title.lower():
        return item.title

    if item.description and q_lower in item.description.lower():
        idx = item.description.lower().find(q_lower)
        start = max(0, idx - 40)
        end = min(len(item.description), idx + len(q_lower) + 60)
        prefix = "..." if start > 0 else ""
        suffix = "..." if end < len(item.description) else ""
        return prefix + item.description[start:end].strip() + suffix

    if hasattr(item, "context") and item.context and item.context.summary:
        if q_lower in item.context.summary.lower():
            idx = item.context.summary.lower().find(q_lower)
            start = max(0, idx - 40)
            end = min(len(item.context.summary), idx + len(q_lower) + 60)
            prefix = "..." if start > 0 else ""
            suffix = "..." if end < len(item.context.summary) else ""
            return prefix + item.context.summary[start:end].strip() + suffix

    for p in item.progress.all()[:3]:
        if q_lower in p.summary.lower():
            return f"[{p.status}] {p.summary}"

    desc_snip = (item.description[:100] + "...") if len(item.description) > 100 else item.description
    return f"{item.title}: {desc_snip}" if desc_snip else item.title


def perform_work_item_search(
    q: str,
    project_key: Optional[str] = None,
    mode: str = "hybrid",
    status: Optional[str] = None,
    priority: Optional[str] = None,
    sprint_id: Optional[int] = None,
    release_id: Optional[int] = None,
    assignee: Optional[str] = None,
    limit: int = 20,
    is_support: bool = False,
) -> dict:
    mode = mode.lower().strip() if mode else "hybrid"
    if mode not in ("hybrid", "vector", "keyword"):
        mode = "hybrid"

    base_qs = WorkItem.objects.filter(is_support=is_support).select_related(
        "project", "parent", "active_assignee", "created_by", "updated_by", "sprint", "release", "context"
    ).prefetch_related("assigned", "watching", "progress__created_by", "progress__updated_by")

    if project_key and project_key.upper() != "ALL":
        base_qs = base_qs.filter(project__key=project_key.upper())

    if priority:
        base_qs = base_qs.filter(priority__iexact=priority)

    if sprint_id and not is_support:
        base_qs = base_qs.filter(sprint_id=sprint_id)

    if release_id and not is_support:
        base_qs = base_qs.filter(release_id=release_id)

    if assignee:
        base_qs = base_qs.filter(active_assignee__username__iexact=assignee)

    if status:
        normalized = status.strip().lower().replace("_", " ")
        latest_status_subquery = Subquery(
            Progress.objects.filter(work_item=OuterRef("pk")).order_by("-created_at", "-id").values("status")[:1]
        )
        base_qs = base_qs.annotate(
            latest_status=Coalesce(latest_status_subquery, Value("todo"))
        ).filter(latest_status__iexact=normalized)

    clean_query = q.strip()
    if not clean_query:
        items = list(base_qs.order_by("-created", "-id")[:limit])
        return {
            "query": q,
            "mode": mode,
            "total": len(items),
            "results": [
                {
                    "work_item": item,
                    "score": 1.0,
                    "vector_distance": None,
                    "rank_vector": None,
                    "rank_keyword": None,
                    "match_type": "exact",
                    "snippet": _extract_snippet(item, clean_query),
                }
                for item in items
            ],
        }

    vector_rank_map = {}
    if mode in ("hybrid", "vector"):
        try:
            from tracker.embedding import get_embedding_provider
            provider = get_embedding_provider()
            q_vec = provider.embed_query(clean_query)

            if connection.vendor == "postgresql":
                from pgvector.django import CosineDistance
                vec_candidates = list(
                    base_qs.filter(embedding__isnull=False)
                    .annotate(distance=CosineDistance("embedding__embedding", q_vec))
                    .order_by("distance")[: limit * 3]
                )
                for rank, item in enumerate(vec_candidates, start=1):
                    vector_rank_map[item.id] = (rank, float(item.distance), item)
            else:
                candidates = list(base_qs.filter(embedding__isnull=False).select_related("embedding"))
                scored = []
                for it in candidates:
                    vec = getattr(it, "embedding", None)
                    if vec and vec.embedding is not None:
                        it_vec = list(vec.embedding)
                        dot = sum(x * y for x, y in zip(q_vec, it_vec))
                        norm_a = sum(x * x for x in q_vec) ** 0.5
                        norm_b = sum(x * x for x in it_vec) ** 0.5
                        sim = dot / (norm_a * norm_b) if norm_a and norm_b else 0.0
                        dist = max(0.0, 1.0 - sim)
                        scored.append((dist, it))
                scored.sort(key=lambda x: x[0])
                for rank, (dist, item) in enumerate(scored[: limit * 3], start=1):
                    vector_rank_map[item.id] = (rank, float(dist), item)
        except Exception as e:
            logger.warning("Vector candidate search failed: %s", e)

    keyword_rank_map = {}
    if mode in ("hybrid", "keyword"):
        kw_candidates = list(
            base_qs.filter(
                Q(key__icontains=clean_query)
                | Q(title__icontains=clean_query)
                | Q(description__icontains=clean_query)
                | Q(context__summary__icontains=clean_query)
            )[: limit * 3]
        )
        for rank, item in enumerate(kw_candidates, start=1):
            keyword_rank_map[item.id] = (rank, item)

    candidate_ids = set(vector_rank_map.keys()) | set(keyword_rank_map.keys())
    if not candidate_ids:
        return {"query": q, "mode": mode, "total": 0, "results": []}

    item_lookup = {}
    for iid, val in vector_rank_map.items():
        item_lookup[iid] = val[2]
    for iid, val in keyword_rank_map.items():
        item_lookup[iid] = val[1]

    scored_results = []
    for iid in candidate_ids:
        item = item_lookup[iid]
        r_vec_info = vector_rank_map.get(iid)
        r_kw_info = keyword_rank_map.get(iid)

        r_vec = r_vec_info[0] if r_vec_info else None
        v_dist = r_vec_info[1] if r_vec_info else None
        r_kw = r_kw_info[0] if r_kw_info else None

        rrf = 0.0
        if r_vec is not None and mode in ("hybrid", "vector"):
            rrf += 1.0 / (60.0 + r_vec)
        if r_kw is not None and mode in ("hybrid", "keyword"):
            rrf += 1.0 / (60.0 + r_kw)

        if r_vec is not None and r_kw is not None:
            match_type = "hybrid"
        elif r_vec is not None:
            match_type = "vector"
        else:
            match_type = "keyword"

        scored_results.append({
            "work_item": item,
            "rrf_raw": rrf,
            "vector_distance": v_dist,
            "rank_vector": r_vec,
            "rank_keyword": r_kw,
            "match_type": match_type,
            "snippet": _extract_snippet(item, clean_query),
        })

    scored_results.sort(key=lambda x: x["rrf_raw"], reverse=True)
    top_results = scored_results[:limit]
    max_rrf = top_results[0]["rrf_raw"] if top_results else 1.0

    final_results = []
    for res in top_results:
        norm_score = round(res["rrf_raw"] / max_rrf, 3) if max_rrf > 0 else 0.0
        final_results.append({
            "work_item": res["work_item"],
            "score": norm_score,
            "vector_distance": round(res["vector_distance"], 4) if res["vector_distance"] is not None else None,
            "rank_vector": res["rank_vector"],
            "rank_keyword": res["rank_keyword"],
            "match_type": res["match_type"],
            "snippet": res["snippet"],
        })

    return {
        "query": q,
        "mode": mode,
        "total": len(final_results),
        "results": final_results,
    }


@api.get("/projects/{project_key}/search", response=SearchResponseOut, summary="Search Work Items in Project")
def search_project_work_items(
    request,
    project_key: str,
    q: str = "",
    mode: str = "hybrid",
    status: Optional[str] = None,
    priority: Optional[str] = None,
    sprint_id: Optional[int] = None,
    release_id: Optional[int] = None,
    assignee: Optional[str] = None,
    limit: int = 20,
    is_support: bool = False,
):
    project = get_object_or_404(Project, key=project_key.upper())
    return perform_work_item_search(
        q=q,
        project_key=project.key,
        mode=mode,
        status=status,
        priority=priority,
        sprint_id=sprint_id,
        release_id=release_id,
        assignee=assignee,
        limit=limit,
        is_support=is_support,
    )


@api.get("/search", response=SearchResponseOut, summary="Global Search Work Items")
def search_work_items(
    request,
    q: str = "",
    project_key: Optional[str] = None,
    mode: str = "hybrid",
    status: Optional[str] = None,
    priority: Optional[str] = None,
    sprint_id: Optional[int] = None,
    release_id: Optional[int] = None,
    assignee: Optional[str] = None,
    limit: int = 20,
    is_support: bool = False,
):
    return perform_work_item_search(
        q=q,
        project_key=project_key,
        mode=mode,
        status=status,
        priority=priority,
        sprint_id=sprint_id,
        release_id=release_id,
        assignee=assignee,
        limit=limit,
        is_support=is_support,
    )


@api.get("/work-items", response=List[WorkItemListOut], summary="List Work Items")
@api.get("/work-items/preview", response=List[WorkItemListOut], summary="Public Preview of Work Items", operation_id="tracker_api_list_work_items_preview")
def list_work_items(request, status: Optional[str] = None, project_key: Optional[str] = None, is_support: bool = False):
    qs = WorkItem.objects.filter(is_support=is_support).select_related(
        "project", "parent", "active_assignee", "created_by", "updated_by", "sprint", "release"
    ).prefetch_related("assigned", "watching", "subtasks").all()

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
    return qs.order_by("-created", "-id")


@api.get("/work-items/{key}", response=WorkItemOut, summary="Get Single Work Item")
def get_work_item(request, key: str):
    return get_object_or_404(
        WorkItem.objects.select_related(
            "project", "parent", "active_assignee", "created_by", "updated_by", "sprint", "release", "context"
        ).prefetch_related("assigned", "watching", "progress__created_by", "progress__updated_by", "subtasks"),
        key=key.upper()
    )


@api.post("/work-items", response=WorkItemOut, auth=api_key_auth, summary="Create Work Item")
def create_work_item(request, payload: CreateWorkItemIn):
    user = request.auth
    project = get_object_or_404(Project, key=payload.project_key.upper())

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
    if payload.sprint_id and not payload.is_support:
        sprint = Sprint.objects.filter(id=payload.sprint_id, project=project).first()

    release = None
    if payload.release_id and not payload.is_support:
        release = Release.objects.filter(id=payload.release_id, project=project).first()

    clean_status = payload.status.strip().lower() if payload.status else None
    if clean_status:
        if clean_status not in ALL_PROGRESS_STATUSES:
            raise errors.HttpError(400, f"Invalid status '{payload.status}'. Allowed statuses are: {', '.join(ALL_PROGRESS_STATUSES)}.")
        if clean_status == "done":
            user_agent = request.headers.get("User-Agent", "")
            if "Davai-MCP" in user_agent:
                raise errors.HttpError(400, "The 'done' status can only be set by a human via the frontend, not via MCP.")

    with transaction.atomic():
        item_key = (
            project.generate_next_user_support_key()
            if payload.is_support
            else project.generate_next_work_item_key()
        )
        item = WorkItem.objects.create(
            project=project,
            parent=parent,
            key=item_key,
            is_support=bool(payload.is_support),
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
        if clean_status not in ALL_PROGRESS_STATUSES:
            raise errors.HttpError(400, f"Invalid status '{payload.status}'. Allowed statuses are: {', '.join(ALL_PROGRESS_STATUSES)}.")
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
    if not item.is_support:
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
# User Support Ticket Endpoints (<PROJECT>-SUP-<ID>)
# ---------------------------------------------------------------------------

@api.get("/projects/{project_key}/user-support/search", response=SearchResponseOut, summary="Search User Support Tickets in Project")
def search_project_user_support(
    request,
    project_key: str,
    q: str = "",
    mode: str = "hybrid",
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee: Optional[str] = None,
    limit: int = 20,
):
    project = get_object_or_404(Project, key=project_key.upper())
    return perform_work_item_search(
        q=q,
        project_key=project.key,
        mode=mode,
        status=status,
        priority=priority,
        assignee=assignee,
        limit=limit,
        is_support=True,
    )


@api.get("/user-support/search", response=SearchResponseOut, summary="Global Search User Support Tickets")
def search_user_support(
    request,
    q: str = "",
    project_key: Optional[str] = None,
    mode: str = "hybrid",
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee: Optional[str] = None,
    limit: int = 20,
):
    return perform_work_item_search(
        q=q,
        project_key=project_key,
        mode=mode,
        status=status,
        priority=priority,
        assignee=assignee,
        limit=limit,
        is_support=True,
    )


@api.get("/projects/{project_key}/user-support", response=List[WorkItemListOut], summary="List Project User Support Tickets")
def list_project_user_support(request, project_key: str, status: Optional[str] = None):
    project = get_object_or_404(Project, key=project_key.upper())
    return list_work_items(request, status=status, project_key=project.key, is_support=True)


@api.get("/user-support", response=List[WorkItemListOut], summary="List User Support Tickets")
def list_user_support(request, status: Optional[str] = None, project_key: Optional[str] = None):
    return list_work_items(request, status=status, project_key=project_key, is_support=True)


@api.get("/user-support/{key}", response=WorkItemOut, summary="Get Single User Support Ticket")
def get_user_support(request, key: str):
    return get_object_or_404(
        WorkItem.objects.filter(is_support=True).select_related(
            "project", "parent", "active_assignee", "created_by", "updated_by", "sprint", "release", "context"
        ).prefetch_related("assigned", "watching", "progress__created_by", "progress__updated_by", "subtasks"),
        key=key.upper()
    )


def _create_user_support_for_project(request, project: Project, payload: CreateUserSupportIn) -> WorkItem:
    user = request.auth
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

    clean_status = payload.status.strip().lower() if payload.status else None
    if clean_status:
        if clean_status not in ALL_PROGRESS_STATUSES:
            raise errors.HttpError(400, f"Invalid status '{payload.status}'. Allowed statuses are: {', '.join(ALL_PROGRESS_STATUSES)}.")
        if clean_status == "done":
            user_agent = request.headers.get("User-Agent", "")
            if "Davai-MCP" in user_agent:
                raise errors.HttpError(400, "The 'done' status can only be set by a human via the frontend, not via MCP.")

    with transaction.atomic():
        item_key = project.generate_next_user_support_key()
        item = WorkItem.objects.create(
            project=project,
            parent=parent,
            key=item_key,
            is_support=True,
            title=payload.title,
            description=payload.description,
            priority=payload.priority.upper(),
            active_assignee=assignee,
            created_by=user,
            source=payload.source,
            start_date=payload.start_date,
            target_date=payload.target_date,
            sprint=None,
            release=None,
        )
        if clean_status and clean_status != "todo":
            Progress.objects.create(
                work_item=item,
                created_by=user,
                summary=f"Initial status set to {clean_status}",
                status=clean_status,
            )
        if payload.context:
            context_obj = Context.objects.create(work_item=item, user=user, summary=payload.context)
            item.context = context_obj
    return item


@api.post("/projects/{project_key}/user-support", response=WorkItemOut, auth=api_key_auth, summary="Create Project User Support Ticket")
def create_project_user_support(request, project_key: str, payload: CreateUserSupportIn):
    project = get_object_or_404(Project, key=project_key.upper())
    return _create_user_support_for_project(request, project, payload)


@api.post("/user-support", response=WorkItemOut, auth=api_key_auth, summary="Create User Support Ticket")
def create_user_support(request, payload: CreateUserSupportIn):
    project = get_object_or_404(Project, key=payload.project_key.upper())
    return _create_user_support_for_project(request, project, payload)


@api.patch("/user-support/{key}", response=WorkItemOut, auth=api_key_auth, summary="Update User Support Ticket")
def update_user_support(request, key: str, payload: UpdateUserSupportIn):
    get_object_or_404(WorkItem, key=key.upper(), is_support=True)
    update_fields = payload.model_dump(exclude_unset=True)
    work_item_payload = UpdateWorkItemIn(**update_fields)
    return update_work_item(request, key, work_item_payload)


@api.delete("/user-support/{key}", auth=api_key_auth, summary="Delete User Support Ticket")
def delete_user_support(request, key: str):
    item = get_object_or_404(WorkItem, key=key.upper(), is_support=True)
    item.delete()
    return {"success": True, "message": f"User support ticket {key.upper()} deleted"}


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
    clean_status = (payload.status or "in progress").strip().lower()
    if clean_status not in ALL_PROGRESS_STATUSES:
        raise errors.HttpError(400, f"Invalid status '{payload.status}'. Allowed statuses are: {', '.join(ALL_PROGRESS_STATUSES)}.")
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
        if clean_status not in ALL_PROGRESS_STATUSES:
            raise errors.HttpError(400, f"Invalid status '{payload.status}'. Allowed statuses are: {', '.join(ALL_PROGRESS_STATUSES)}.")
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


# ---------------------------------------------------------------------------
# Incident & Monitoring Log Schemas and Endpoints
# ---------------------------------------------------------------------------

class MonitoringLogLinkOut(Schema):
    id: int
    key: str
    status: str
    who_are_you: str
    created_at: str

    @staticmethod
    def resolve_created_at(obj: Any) -> str:
        val = getattr(obj, "created_at", None) if not isinstance(obj, dict) else obj.get("created_at")
        return val.isoformat() if hasattr(val, "isoformat") else str(val or "")


class IncidentOut(Schema):
    id: int
    key: str
    project_key: str
    title: str
    cause: str
    description: str
    investigation_note: str
    status: str
    work_items: List[SubtaskSummaryOut] = []
    work_item_keys: List[str] = []
    monitoring_log_ids: List[int] = []
    monitoring_log_keys: List[str] = []
    monitoring_logs: List[MonitoringLogLinkOut] = []
    created_by: str
    updated_by: Optional[str] = None
    created_at: str
    updated_at: str

    @staticmethod
    def resolve_project_key(obj: Incident) -> str:
        return obj.project.key

    @staticmethod
    def resolve_description(obj: Incident) -> str:
        return obj.cause

    @staticmethod
    def resolve_work_items(obj: Incident) -> List[SubtaskSummaryOut]:
        return [SubtaskSummaryOut(key=w.key, title=w.title) for w in obj.work_items.all()]

    @staticmethod
    def resolve_work_item_keys(obj: Incident) -> List[str]:
        return [w.key for w in obj.work_items.all()]

    @staticmethod
    def resolve_monitoring_log_ids(obj: Incident) -> List[int]:
        return [m.id for m in obj.monitoring_logs.all()]

    @staticmethod
    def resolve_monitoring_log_keys(obj: Incident) -> List[str]:
        return [m.key for m in obj.monitoring_logs.all()]

    @staticmethod
    def resolve_monitoring_logs(obj: Incident) -> List[Any]:
        return list(obj.monitoring_logs.all())

    @staticmethod
    def resolve_created_by(obj: Incident) -> str:
        return obj.created_by.username if obj.created_by else "System"

    @staticmethod
    def resolve_updated_by(obj: Incident) -> Optional[str]:
        return obj.updated_by.username if obj.updated_by else None

    @staticmethod
    def resolve_created_at(obj: Incident) -> str:
        return obj.created_at.isoformat()

    @staticmethod
    def resolve_updated_at(obj: Incident) -> str:
        return obj.updated_at.isoformat()


class IncidentSearchResultOut(Schema):
    incident: IncidentOut
    score: float
    vector_distance: Optional[float] = None
    rank_vector: Optional[int] = None
    rank_keyword: Optional[int] = None
    match_type: str
    snippet: str


class IncidentSearchResponseOut(Schema):
    query: str
    mode: str
    total: int
    results: List[IncidentSearchResultOut]


class CreateIncidentIn(Schema):
    project_key: str = "DAV"
    title: str
    cause: str = ""
    description: Optional[str] = None
    investigation_note: str = ""
    status: Optional[str] = "reported"
    work_item_keys: Optional[List[str]] = None
    monitoring_log_ids: Optional[List[Any]] = None


class UpdateIncidentIn(Schema):
    title: Optional[str] = None
    cause: Optional[str] = None
    description: Optional[str] = None
    investigation_note: Optional[str] = None
    status: Optional[str] = None
    work_item_keys: Optional[List[str]] = None
    monitoring_log_ids: Optional[List[Any]] = None


class MonitoringLogOut(Schema):
    id: int
    key: str
    project_key: str
    who_are_you: str
    description: str
    status: str
    incident_id: Optional[int] = None
    incident_key: Optional[str] = None
    jira_url: str
    created_by: str
    created_at: str

    @staticmethod
    def resolve_project_key(obj: MonitoringLog) -> str:
        return obj.project.key

    @staticmethod
    def resolve_incident_id(obj: MonitoringLog) -> Optional[int]:
        return obj.incident_id

    @staticmethod
    def resolve_incident_key(obj: MonitoringLog) -> Optional[str]:
        return obj.incident.key if obj.incident else None

    @staticmethod
    def resolve_created_by(obj: MonitoringLog) -> str:
        return obj.created_by.username if obj.created_by else "System"

    @staticmethod
    def resolve_created_at(obj: MonitoringLog) -> str:
        return obj.created_at.isoformat()


class CreateMonitoringLogIn(Schema):
    project_key: str = "DAV"
    who_are_you: str = ""
    description: str
    status: str = "ok"
    incident_id: Optional[Any] = None
    incident_key: Optional[str] = None
    jira_url: str = ""


class UpdateMonitoringLogIn(Schema):
    who_are_you: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    incident_id: Optional[Any] = None
    incident_key: Optional[str] = None
    jira_url: Optional[str] = None


def _get_incident_by_identifier(identifier: Any, project: Optional[Project] = None) -> Incident:
    qs = Incident.objects.select_related(
        "project", "created_by", "updated_by"
    ).prefetch_related("work_items", "monitoring_logs")
    if project:
        qs = qs.filter(project=project)

    ident_str = str(identifier).strip()
    if ident_str.isdigit():
        obj = qs.filter(id=int(ident_str)).first()
    else:
        obj = qs.filter(key__iexact=ident_str).first()

    if not obj:
        raise errors.HttpError(404, f"Incident '{identifier}' not found.")
    return obj


def _get_monitoring_log_by_identifier(identifier: Any, project: Optional[Project] = None) -> MonitoringLog:
    qs = MonitoringLog.objects.select_related("project", "incident", "created_by")
    if project:
        qs = qs.filter(project=project)

    ident_str = str(identifier).strip()
    if ident_str.isdigit():
        obj = qs.filter(id=int(ident_str)).first()
    else:
        obj = qs.filter(key__iexact=ident_str).first()

    if not obj:
        raise errors.HttpError(404, f"Monitoring log '{identifier}' not found.")
    return obj


def _extract_incident_snippet(incident: Incident, query: str) -> str:
    q_lower = query.lower().strip()
    if not q_lower:
        return incident.title

    if q_lower in incident.title.lower():
        return incident.title

    if incident.cause and q_lower in incident.cause.lower():
        idx = incident.cause.lower().find(q_lower)
        start = max(0, idx - 40)
        end = min(len(incident.cause), idx + len(q_lower) + 60)
        prefix = "..." if start > 0 else ""
        suffix = "..." if end < len(incident.cause) else ""
        return prefix + incident.cause[start:end].strip() + suffix

    if incident.investigation_note and q_lower in incident.investigation_note.lower():
        idx = incident.investigation_note.lower().find(q_lower)
        start = max(0, idx - 40)
        end = min(len(incident.investigation_note), idx + len(q_lower) + 60)
        prefix = "..." if start > 0 else ""
        suffix = "..." if end < len(incident.investigation_note) else ""
        return prefix + incident.investigation_note[start:end].strip() + suffix

    cause_snip = (incident.cause[:100] + "...") if len(incident.cause) > 100 else incident.cause
    return f"{incident.title}: {cause_snip}" if cause_snip else incident.title


def perform_incident_search(
    q: str,
    project_key: Optional[str] = None,
    mode: str = "hybrid",
    status: Optional[str] = None,
    limit: int = 20,
) -> dict:
    """
    Performs semantic/hybrid/keyword search over Incidents.
    Always excludes 'no longer relevant' incidents from all searches.
    """
    mode = mode.lower().strip() if mode else "hybrid"
    if mode not in ("hybrid", "vector", "keyword"):
        mode = "hybrid"

    base_qs = (
        Incident.objects.select_related("project", "created_by", "updated_by")
        .prefetch_related("work_items", "monitoring_logs")
        .exclude(status__iexact="no longer relevant")
    )

    if project_key and project_key.upper() != "ALL":
        base_qs = base_qs.filter(project__key=project_key.upper())

    if status:
        norm_status = status.strip().lower().replace("_", " ")
        if norm_status == "no longer relevant":
            return {"query": q, "mode": mode, "total": 0, "results": []}
        base_qs = base_qs.filter(status__iexact=norm_status)

    clean_query = q.strip()
    if not clean_query:
        incidents = list(base_qs.order_by("-created_at", "-id")[:limit])
        return {
            "query": q,
            "mode": mode,
            "total": len(incidents),
            "results": [
                {
                    "incident": inc,
                    "score": 1.0,
                    "vector_distance": None,
                    "rank_vector": None,
                    "rank_keyword": None,
                    "match_type": "exact",
                    "snippet": _extract_incident_snippet(inc, clean_query),
                }
                for inc in incidents
            ],
        }

    vector_rank_map = {}
    if mode in ("hybrid", "vector"):
        try:
            from tracker.embedding import get_embedding_provider
            provider = get_embedding_provider()
            q_vec = provider.embed_query(clean_query)

            if connection.vendor == "postgresql":
                from pgvector.django import CosineDistance
                vec_candidates = list(
                    base_qs.filter(embedding__isnull=False)
                    .annotate(distance=CosineDistance("embedding__embedding", q_vec))
                    .order_by("distance")[: limit * 3]
                )
                for rank, inc in enumerate(vec_candidates, start=1):
                    vector_rank_map[inc.id] = (rank, float(inc.distance), inc)
            else:
                candidates = list(base_qs.filter(embedding__isnull=False).select_related("embedding"))
                scored = []
                for inc in candidates:
                    vec = getattr(inc, "embedding", None)
                    if vec and vec.embedding is not None:
                        it_vec = list(vec.embedding)
                        dot = sum(x * y for x, y in zip(q_vec, it_vec))
                        norm_a = sum(x * x for x in q_vec) ** 0.5
                        norm_b = sum(x * x for x in it_vec) ** 0.5
                        sim = dot / (norm_a * norm_b) if norm_a and norm_b else 0.0
                        dist = max(0.0, 1.0 - sim)
                        scored.append((dist, inc))
                scored.sort(key=lambda x: x[0])
                for rank, (dist, inc) in enumerate(scored[: limit * 3], start=1):
                    vector_rank_map[inc.id] = (rank, float(dist), inc)
        except Exception as e:
            logger.warning("Incident vector candidate search failed: %s", e)

    keyword_rank_map = {}
    if mode in ("hybrid", "keyword"):
        phrase_q = (
            Q(key__icontains=clean_query)
            | Q(title__icontains=clean_query)
            | Q(cause__icontains=clean_query)
            | Q(investigation_note__icontains=clean_query)
        )
        tokens = [t for t in clean_query.split() if t]
        if len(tokens) > 1:
            token_q = Q()
            for tok in tokens:
                token_q &= (
                    Q(key__icontains=tok)
                    | Q(title__icontains=tok)
                    | Q(cause__icontains=tok)
                    | Q(investigation_note__icontains=tok)
                )
            kw_filter = phrase_q | token_q
        else:
            kw_filter = phrase_q
        kw_candidates = list(base_qs.filter(kw_filter)[: limit * 3])
        for rank, inc in enumerate(kw_candidates, start=1):
            keyword_rank_map[inc.id] = (rank, inc)

    candidate_ids = set(vector_rank_map.keys()) | set(keyword_rank_map.keys())
    if not candidate_ids:
        return {"query": q, "mode": mode, "total": 0, "results": []}

    inc_lookup = {}
    for iid, val in vector_rank_map.items():
        inc_lookup[iid] = val[2]
    for iid, val in keyword_rank_map.items():
        inc_lookup[iid] = val[1]

    scored_results = []
    for iid in candidate_ids:
        inc = inc_lookup[iid]
        r_vec_info = vector_rank_map.get(iid)
        r_kw_info = keyword_rank_map.get(iid)

        r_vec = r_vec_info[0] if r_vec_info else None
        v_dist = r_vec_info[1] if r_vec_info else None
        r_kw = r_kw_info[0] if r_kw_info else None

        rrf = 0.0
        if r_vec is not None and mode in ("hybrid", "vector"):
            rrf += 1.0 / (60.0 + r_vec)
        if r_kw is not None and mode in ("hybrid", "keyword"):
            rrf += 1.0 / (60.0 + r_kw)

        if r_vec is not None and r_kw is not None:
            match_type = "hybrid"
        elif r_vec is not None:
            match_type = "vector"
        else:
            match_type = "keyword"

        scored_results.append({
            "incident": inc,
            "rrf_raw": rrf,
            "vector_distance": v_dist,
            "rank_vector": r_vec,
            "rank_keyword": r_kw,
            "match_type": match_type,
            "snippet": _extract_incident_snippet(inc, clean_query),
        })

    scored_results.sort(key=lambda x: x["rrf_raw"], reverse=True)
    top_results = scored_results[:limit]
    max_rrf = top_results[0]["rrf_raw"] if top_results else 1.0

    final_results = []
    for res in top_results:
        norm_score = round(res["rrf_raw"] / max_rrf, 3) if max_rrf > 0 else 0.0
        final_results.append({
            "incident": res["incident"],
            "score": norm_score,
            "vector_distance": round(res["vector_distance"], 4) if res["vector_distance"] is not None else None,
            "rank_vector": res["rank_vector"],
            "rank_keyword": res["rank_keyword"],
            "match_type": res["match_type"],
            "snippet": res["snippet"],
        })

    return {
        "query": q,
        "mode": mode,
        "total": len(final_results),
        "results": final_results,
    }


def _validate_and_normalize_incident_status(request, raw_status: Optional[str], default: str = "reported") -> str:
    if not raw_status:
        return default
    clean_status = raw_status.strip().lower().replace("_", " ")
    if clean_status not in INCIDENT_STATUSES:
        raise errors.HttpError(
            400,
            f"Invalid incident status '{raw_status}'. Allowed statuses are: {', '.join(INCIDENT_STATUSES)}."
        )
    if clean_status in HUMAN_ONLY_INCIDENT_STATUSES:
        user_agent = request.headers.get("User-Agent", "")
        if "Davai-MCP" in user_agent:
            raise errors.HttpError(
                400,
                f"The '{clean_status}' status can only be set by a human via the frontend, not via MCP."
            )
    return clean_status


def _resolve_linked_work_items(project: Project, work_item_keys: List[str]) -> List[WorkItem]:
    items = []
    for raw_key in work_item_keys:
        k = str(raw_key).strip().upper()
        if not k:
            continue
        wi = WorkItem.objects.filter(key=k).first()
        if not wi:
            raise errors.HttpError(400, f"Work item '{raw_key}' not found.")
        if wi.project_id != project.id:
            raise errors.HttpError(400, f"Work item '{wi.key}' belongs to project '{wi.project.key}', not '{project.key}'.")
        items.append(wi)
    return items


def _resolve_linked_monitoring_logs(project: Project, log_identifiers: List[Any]) -> List[MonitoringLog]:
    logs = []
    for raw_id in log_identifiers:
        ident = str(raw_id).strip()
        if not ident:
            continue
        if ident.isdigit():
            ml = MonitoringLog.objects.filter(id=int(ident)).first()
        else:
            ml = MonitoringLog.objects.filter(key__iexact=ident).first()
        if not ml:
            raise errors.HttpError(400, f"Monitoring log '{raw_id}' not found.")
        if ml.project_id != project.id:
            raise errors.HttpError(
                400,
                f"Monitoring log '{ml.key}' belongs to project '{ml.project.key}', not '{project.key}'."
            )
        logs.append(ml)
    return logs


@api.get("/projects/{project_key}/incidents/search", response=IncidentSearchResponseOut, summary="Search Incidents in Project")
def search_project_incidents(
    request,
    project_key: str,
    q: str = "",
    mode: str = "hybrid",
    status: Optional[str] = None,
    limit: int = 20,
):
    project = get_object_or_404(Project, key=project_key.upper())
    return perform_incident_search(
        q=q,
        project_key=project.key,
        mode=mode,
        status=status,
        limit=limit,
    )


@api.get("/incidents/search", response=IncidentSearchResponseOut, summary="Global Search Incidents")
def search_incidents(
    request,
    q: str = "",
    project_key: Optional[str] = None,
    mode: str = "hybrid",
    status: Optional[str] = None,
    limit: int = 20,
):
    return perform_incident_search(
        q=q,
        project_key=project_key,
        mode=mode,
        status=status,
        limit=limit,
    )


@api.get("/projects/{project_key}/incidents", response=List[IncidentOut], summary="List Project Incidents")
def list_project_incidents(request, project_key: str, status: Optional[str] = None):
    project = get_object_or_404(Project, key=project_key.upper())
    qs = (
        Incident.objects.filter(project=project)
        .select_related("project", "created_by", "updated_by")
        .prefetch_related("work_items", "monitoring_logs")
    )
    if status:
        norm = status.strip().lower().replace("_", " ")
        qs = qs.filter(status__iexact=norm)
    return qs.order_by("-created_at", "-id")


@api.get("/incidents", response=List[IncidentOut], summary="List Incidents")
def list_incidents(request, project_key: Optional[str] = None, status: Optional[str] = None):
    qs = (
        Incident.objects.select_related("project", "created_by", "updated_by")
        .prefetch_related("work_items", "monitoring_logs")
        .all()
    )
    if project_key:
        qs = qs.filter(project__key=project_key.upper())
    if status:
        norm = status.strip().lower().replace("_", " ")
        qs = qs.filter(status__iexact=norm)
    return qs.order_by("-created_at", "-id")


@api.get("/incidents/{incident_id}", response=IncidentOut, summary="Get Single Incident")
def get_incident(request, incident_id: str):
    return _get_incident_by_identifier(incident_id)


def _create_incident_for_project(request, project: Project, payload: CreateIncidentIn) -> Incident:
    user = request.auth
    clean_status = _validate_and_normalize_incident_status(request, payload.status, default="reported")

    cause_val = payload.cause
    if not cause_val and payload.description:
        cause_val = payload.description

    linked_items = _resolve_linked_work_items(project, payload.work_item_keys) if payload.work_item_keys else []
    linked_logs = _resolve_linked_monitoring_logs(project, payload.monitoring_log_ids) if payload.monitoring_log_ids else []

    with transaction.atomic():
        inc_key = project.generate_next_incident_key()
        incident = Incident.objects.create(
            project=project,
            key=inc_key,
            title=payload.title,
            cause=cause_val,
            investigation_note=payload.investigation_note,
            status=clean_status,
            created_by=user,
            updated_by=user,
        )
        if linked_items:
            incident.work_items.set(linked_items)
        if linked_logs:
            for ml in linked_logs:
                ml.incident = incident
                ml.save(update_fields=["incident"])

    return _get_incident_by_identifier(incident.key)


@api.post("/projects/{project_key}/incidents", response=IncidentOut, auth=api_key_auth, summary="Create Project Incident")
def create_project_incident(request, project_key: str, payload: CreateIncidentIn):
    project = get_object_or_404(Project, key=project_key.upper())
    return _create_incident_for_project(request, project, payload)


@api.post("/incidents", response=IncidentOut, auth=api_key_auth, summary="Create Incident")
def create_incident(request, payload: CreateIncidentIn):
    project = get_object_or_404(Project, key=payload.project_key.upper())
    return _create_incident_for_project(request, project, payload)


@api.patch("/incidents/{incident_id}", response=IncidentOut, auth=api_key_auth, summary="Update Incident")
def update_incident(request, incident_id: str, payload: UpdateIncidentIn):
    user = request.auth
    incident = _get_incident_by_identifier(incident_id)

    if payload.title is not None:
        incident.title = payload.title
    if payload.cause is not None:
        incident.cause = payload.cause
    elif payload.description is not None:
        incident.cause = payload.description
    if payload.investigation_note is not None:
        incident.investigation_note = payload.investigation_note
    if payload.status is not None:
        incident.status = _validate_and_normalize_incident_status(request, payload.status)

    if payload.work_item_keys is not None:
        linked_items = _resolve_linked_work_items(incident.project, payload.work_item_keys)
        incident.work_items.set(linked_items)

    if payload.monitoring_log_ids is not None:
        linked_logs = _resolve_linked_monitoring_logs(incident.project, payload.monitoring_log_ids)
        # Update monitoring logs to link to this incident
        incident.monitoring_logs.exclude(id__in=[m.id for m in linked_logs]).update(incident=None)
        for ml in linked_logs:
            if ml.incident_id != incident.id:
                ml.incident = incident
                ml.save(update_fields=["incident"])

    incident.updated_by = user
    incident.save()
    return _get_incident_by_identifier(incident.key)


@api.delete("/incidents/{incident_id}", auth=api_key_auth, summary="Delete Incident")
def delete_incident(request, incident_id: str):
    incident = _get_incident_by_identifier(incident_id)
    key = incident.key
    incident.delete()
    return {"success": True, "message": f"Incident {key} deleted"}


def _validate_and_normalize_log_status(raw_status: Optional[str]) -> str:
    if not raw_status:
        return "ok"
    clean = raw_status.strip().lower()
    if clean not in MONITORING_LOG_STATUSES:
        raise errors.HttpError(
            400,
            f"Invalid monitoring log status '{raw_status}'. Allowed statuses are: OK, Error."
        )
    return clean


@api.get("/projects/{project_key}/monitoring-logs", response=List[MonitoringLogOut], summary="List Project Monitoring Logs")
def list_project_monitoring_logs(request, project_key: str, status: Optional[str] = None, incident_id: Optional[str] = None):
    project = get_object_or_404(Project, key=project_key.upper())
    qs = MonitoringLog.objects.filter(project=project).select_related("project", "incident", "created_by")
    if status:
        qs = qs.filter(status__iexact=status.strip().lower())
    if incident_id:
        inc = _get_incident_by_identifier(incident_id, project=project)
        qs = qs.filter(incident=inc)
    return qs.order_by("-created_at", "-id")


@api.get("/monitoring-logs", response=List[MonitoringLogOut], summary="List Monitoring Logs")
def list_monitoring_logs(request, project_key: Optional[str] = None, status: Optional[str] = None, incident_id: Optional[str] = None):
    qs = MonitoringLog.objects.select_related("project", "incident", "created_by").all()
    if project_key:
        qs = qs.filter(project__key=project_key.upper())
    if status:
        qs = qs.filter(status__iexact=status.strip().lower())
    if incident_id:
        inc = _get_incident_by_identifier(incident_id)
        qs = qs.filter(incident=inc)
    return qs.order_by("-created_at", "-id")


@api.get("/monitoring-logs/{log_id}", response=MonitoringLogOut, summary="Get Single Monitoring Log")
def get_monitoring_log(request, log_id: str):
    return _get_monitoring_log_by_identifier(log_id)


def _create_monitoring_log_for_project(request, project: Project, payload: CreateMonitoringLogIn) -> MonitoringLog:
    user = request.auth
    clean_status = _validate_and_normalize_log_status(payload.status)

    inc_ref = payload.incident_id if payload.incident_id is not None else payload.incident_key
    incident = None
    if inc_ref not in (None, "", 0, "0"):
        incident = _get_incident_by_identifier(inc_ref, project=project)

    with transaction.atomic():
        log_key = project.generate_next_monitoring_log_key()
        log_obj = MonitoringLog.objects.create(
            project=project,
            key=log_key,
            who_are_you=payload.who_are_you,
            description=payload.description,
            status=clean_status,
            incident=incident,
            jira_url=payload.jira_url,
            created_by=user,
        )
    return log_obj


@api.post("/projects/{project_key}/monitoring-logs", response=MonitoringLogOut, auth=api_key_auth, summary="Create Project Monitoring Log")
def create_project_monitoring_log(request, project_key: str, payload: CreateMonitoringLogIn):
    project = get_object_or_404(Project, key=project_key.upper())
    return _create_monitoring_log_for_project(request, project, payload)


@api.post("/monitoring-logs", response=MonitoringLogOut, auth=api_key_auth, summary="Create Monitoring Log")
def create_monitoring_log(request, payload: CreateMonitoringLogIn):
    project = get_object_or_404(Project, key=payload.project_key.upper())
    return _create_monitoring_log_for_project(request, project, payload)


@api.patch("/monitoring-logs/{log_id}", response=MonitoringLogOut, auth=api_key_auth, summary="Update Monitoring Log")
def update_monitoring_log(request, log_id: str, payload: UpdateMonitoringLogIn):
    log_obj = _get_monitoring_log_by_identifier(log_id)

    if payload.who_are_you is not None:
        log_obj.who_are_you = payload.who_are_you
    if payload.description is not None:
        log_obj.description = payload.description
    if payload.status is not None:
        log_obj.status = _validate_and_normalize_log_status(payload.status)
    if payload.jira_url is not None:
        log_obj.jira_url = payload.jira_url

    if "incident_id" in payload.model_fields_set or "incident_key" in payload.model_fields_set:
        inc_ref = payload.incident_id if "incident_id" in payload.model_fields_set else payload.incident_key
        if inc_ref in (None, "", 0, "0"):
            log_obj.incident = None
        else:
            log_obj.incident = _get_incident_by_identifier(inc_ref, project=log_obj.project)

    log_obj.save()
    return log_obj


@api.delete("/monitoring-logs/{log_id}", auth=api_key_auth, summary="Delete Monitoring Log")
def delete_monitoring_log(request, log_id: str):
    log_obj = _get_monitoring_log_by_identifier(log_id)
    key = log_obj.key
    log_obj.delete()
    return {"success": True, "message": f"Monitoring log {key} deleted"}


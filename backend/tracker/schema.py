import strawberry
from typing import List, Optional, Any
from asgiref.sync import sync_to_async
from strawberry.permission import BasePermission
from strawberry.types import Info
from tracker.auth import verify_api_key
from tracker.models import (
    WorkItem as WorkItemModel,
    Project as ProjectModel,
    Sprint as SprintModel,
    Release as ReleaseModel,
    Context as ContextModel,
    Progress as ProgressModel,
)


class HasApiKey(BasePermission):
    message = "Authentication required: A valid API key must be provided via 'X-API-Key' header or 'api_key' query parameter."

    async def has_permission(self, source: Any, info: Info, **kwargs) -> bool:
        request = getattr(info.context, "request", None)
        if request is None and isinstance(info.context, dict):
            request = info.context.get("request")

        api_key = None
        if request:
            api_key = request.headers.get("X-API-Key") or request.GET.get("api_key")
            if not api_key:
                auth = request.headers.get("Authorization", "")
                if auth.startswith("Bearer "):
                    api_key = auth[7:].strip()
                elif auth.startswith("ApiKey "):
                    api_key = auth[7:].strip()
        elif isinstance(info.context, dict):
            api_key = info.context.get("api_key") or info.context.get("X-API-Key")

        if not api_key:
            return False

        user = await sync_to_async(verify_api_key)(api_key)
        if user:
            if hasattr(info.context, "user"):
                info.context.user = user
            elif isinstance(info.context, dict):
                info.context["user"] = user
            return True
        return False


@strawberry.type
class ProjectStatusType:
    id: int
    name: str
    order: int
    is_default: bool


@strawberry.type
class ProjectType:
    id: int
    key: str
    name: str
    description: str


@strawberry.type
class ReleaseType:
    id: int
    project_key: str
    name: str
    description: str
    start_date: Optional[str]
    end_date: Optional[str]


@strawberry.type
class SprintType:
    id: int
    project_key: str
    name: str
    description: str
    start_date: Optional[str]
    end_date: Optional[str]


@strawberry.type
class ContextType:
    id: int
    user: Optional[str]
    summary: str
    timestamp: str


@strawberry.type
class ProgressType:
    id: int
    user: Optional[str]
    summary: str
    proof: str
    status: str
    timestamp: str


@strawberry.type
class WorkItemType:
    id: int
    key: str
    parent_key: Optional[str]
    title: str
    descr: str
    status: str
    priority: str
    project_key: str
    active_assignee: Optional[str]
    created_by: str
    created: str
    updated: str
    context: Optional[ContextType]
    progress: List[ProgressType]


def _to_work_item_type(item: WorkItemModel) -> WorkItemType:
    ctx = None
    if hasattr(item, "context") and item.context:
        ctx = ContextType(
            id=item.context.id,
            user=item.context.user.username if item.context.user else None,
            summary=item.context.summary,
            timestamp=item.context.timestamp.isoformat(),
        )

    progress_list = [
        ProgressType(
            id=p.id,
            user=p.user.username if p.user else None,
            summary=p.summary,
            proof=p.proof,
            status=p.status,
            timestamp=p.timestamp.isoformat(),
        )
        for p in item.progress.all()
    ]

    return WorkItemType(
        id=item.id,
        key=item.key,
        parent_key=item.parent.key if item.parent else None,
        title=item.title,
        descr=item.descr or "",
        status=item.status.name if item.status else "None",
        priority=item.priority,
        project_key=item.project.key,
        active_assignee=item.active_assignee.username if item.active_assignee else None,
        created_by=item.created_by.username if item.created_by else "System",
        created=item.created.isoformat(),
        updated=item.updated.isoformat(),
        context=ctx,
        progress=progress_list,
    )


@strawberry.type
class Query:
    @strawberry.field(permission_classes=[HasApiKey])
    def hello(self) -> str:
        return "Hello from Strawberry GraphQL!"

    @strawberry.field(permission_classes=[HasApiKey])
    async def projects(self) -> List[ProjectType]:
        def _get():
            return [
                ProjectType(id=p.id, key=p.key, name=p.name, description=p.description)
                for p in ProjectModel.objects.all()
            ]
        return await sync_to_async(_get)()

    @strawberry.field(permission_classes=[HasApiKey])
    async def work_items(self, status: Optional[str] = None, project_key: Optional[str] = None) -> List[WorkItemType]:
        def _get():
            qs = WorkItemModel.objects.select_related(
                "project", "parent", "status", "active_assignee", "created_by", "context"
            ).prefetch_related("progress").all()
            if status:
                normalized = status.strip().replace("_", " ")
                qs = qs.filter(status__name__iexact=normalized)
            if project_key:
                qs = qs.filter(project__key=project_key.upper())
            return [_to_work_item_type(item) for item in qs]
        return await sync_to_async(_get)()

    @strawberry.field(permission_classes=[HasApiKey])
    async def work_item(self, key: str) -> Optional[WorkItemType]:
        def _get():
            item = WorkItemModel.objects.select_related(
                "project", "parent", "status", "active_assignee", "created_by", "context"
            ).prefetch_related("progress").filter(key=key.upper()).first()
            return _to_work_item_type(item) if item else None
        return await sync_to_async(_get)()


schema = strawberry.Schema(query=Query)

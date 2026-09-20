import strawberry
from typing import List, Optional
from asgiref.sync import sync_to_async
from tracker.models import WorkItem as WorkItemModel, Project as ProjectModel

@strawberry.type
class ProjectType:
    id: int
    key: str
    name: str
    description: str

@strawberry.type
class WorkItemType:
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

def _to_work_item_type(item: WorkItemModel) -> WorkItemType:
    return WorkItemType(
        id=item.id,
        key=item.key,
        title=item.title,
        description=item.description or "",
        status=item.status,
        priority=item.priority,
        project_key=item.project.key,
        assignee=item.assignee.username if item.assignee else "Unassigned",
        reporter=item.reporter.username if item.reporter else "System",
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
    )

@strawberry.type
class Query:
    @strawberry.field
    def hello(self) -> str:
        return "Hello from Strawberry GraphQL!"

    @strawberry.field
    async def projects(self) -> List[ProjectType]:
        def _get():
            return [
                ProjectType(id=p.id, key=p.key, name=p.name, description=p.description)
                for p in ProjectModel.objects.all()
            ]
        return await sync_to_async(_get)()

    @strawberry.field
    async def work_items(self, status: Optional[str] = None, project_key: Optional[str] = None) -> List[WorkItemType]:
        def _get():
            qs = WorkItemModel.objects.select_related("project", "assignee", "reporter").all()
            if status:
                qs = qs.filter(status=status.upper())
            if project_key:
                qs = qs.filter(project__key=project_key.upper())
            return [_to_work_item_type(item) for item in qs]
        return await sync_to_async(_get)()

    @strawberry.field
    async def work_item(self, key: str) -> Optional[WorkItemType]:
        def _get():
            item = WorkItemModel.objects.select_related("project", "assignee", "reporter").filter(key=key.upper()).first()
            return _to_work_item_type(item) if item else None
        return await sync_to_async(_get)()

schema = strawberry.Schema(query=Query)

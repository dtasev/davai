import strawberry
from typing import List, Optional
from core.store import list_items, get_item, add_item

@strawberry.type
class WorkItemType:
    id: str
    key: str
    title: str
    status: str
    priority: str
    assignee: str

@strawberry.type
class Query:
    @strawberry.field
    def hello(self) -> str:
        return "Hello from Strawberry GraphQL!"

    @strawberry.field
    def work_items(self, status: Optional[str] = None) -> List[WorkItemType]:
        items = list_items(status)
        return [
            WorkItemType(
                id=i["id"],
                key=i["key"],
                title=i["title"],
                status=i["status"],
                priority=i["priority"],
                assignee=i["assignee"]
            )
            for i in items
        ]

    @strawberry.field
    def work_item(self, key: str) -> Optional[WorkItemType]:
        i = get_item(key)
        if not i:
            return None
        return WorkItemType(
            id=i["id"],
            key=i["key"],
            title=i["title"],
            status=i["status"],
            priority=i["priority"],
            assignee=i["assignee"]
        )

schema = strawberry.Schema(query=Query)

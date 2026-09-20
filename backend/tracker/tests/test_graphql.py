import pytest
from asgiref.sync import sync_to_async
from tracker.schema import schema
from tracker.models import WorkItem

@pytest.mark.django_db
@pytest.mark.asyncio
async def test_graphql_hello():
    res = await schema.execute("query { hello }")
    assert res.errors is None
    assert res.data["hello"] == "Hello from Strawberry GraphQL!"

@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_graphql_projects_and_items(test_project, test_user):
    await sync_to_async(WorkItem.objects.create)(
        project=test_project,
        key=f"{test_project.key}-100",
        title="GraphQL Test Item",
        descr="Created for testing GraphQL schema",
        priority="HIGH",
        created_by=test_user
    )

    query = """
    query {
        projects {
            key
            name
        }
        workItems {
            key
            title
            descr
            status
            priority
            projectKey
        }
        workItem(key: "DAV-100") {
            key
            title
            descr
            status
        }
    }
    """
    res = await schema.execute(query)
    assert res.errors is None
    assert len(res.data["projects"]) >= 1
    assert any(p["key"] == test_project.key for p in res.data["projects"])
    assert any(i["key"] == f"{test_project.key}-100" for i in res.data["workItems"])
    assert res.data["workItem"]["title"] == "GraphQL Test Item"
    assert res.data["workItem"]["descr"] == "Created for testing GraphQL schema"
    assert res.data["workItem"]["status"] == "todo"

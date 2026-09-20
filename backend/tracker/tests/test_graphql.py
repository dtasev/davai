import pytest
from asgiref.sync import sync_to_async
from tracker.schema import schema
from tracker.models import WorkItem

@pytest.mark.django_db
@pytest.mark.asyncio
async def test_graphql_unauthenticated():
    # Attempt query with no API key
    res = await schema.execute("query { hello }")
    assert res.errors is not None
    assert any("Authentication required" in err.message for err in res.errors)

    # Attempt query with invalid API key
    res_fake = await schema.execute(
        "query { hello }",
        context_value={"api_key": "dav_live_invalid_token"}
    )
    assert res_fake.errors is not None
    assert any("Authentication required" in err.message for err in res_fake.errors)

@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_graphql_hello_authorized(test_api_key):
    _, raw_key = test_api_key
    res = await schema.execute(
        "query { hello }",
        context_value={"api_key": raw_key}
    )
    assert res.errors is None
    assert res.data["hello"] == "Hello from Strawberry GraphQL!"

@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_graphql_projects_and_items(test_project, test_user, test_api_key):
    _, raw_key = test_api_key
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
    res = await schema.execute(
        query,
        context_value={"api_key": raw_key}
    )
    assert res.errors is None
    assert len(res.data["projects"]) >= 1
    assert any(p["key"] == test_project.key for p in res.data["projects"])
    assert any(i["key"] == f"{test_project.key}-100" for i in res.data["workItems"])
    assert res.data["workItem"]["title"] == "GraphQL Test Item"
    assert res.data["workItem"]["descr"] == "Created for testing GraphQL schema"
    assert res.data["workItem"]["status"] == "todo"

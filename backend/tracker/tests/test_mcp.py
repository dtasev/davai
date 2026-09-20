import pytest
import urllib.parse
from mcp_server.client import DavaiClient
from mcp_server.server import (
    list_work_items,
    create_work_item,
    update_work_item,
    get_work_item,
    set_work_item_context,
    log_work_item_progress,
    list_sprints,
    list_releases,
    get_project_summary,
    get_board_state,
    set_client
)
from tracker.models import Sprint, Release

class InProcessDavaiClient(DavaiClient):
    """
    Adapter running DavaiClient methods against Django Ninja's native TestClient
    for lightning-fast in-memory test execution without network sockets.
    """
    def __init__(self, ninja_client, api_key=None):
        super().__init__(base_url="http://testserver/api", api_key=api_key)
        self.ninja_client = ninja_client

    def _request(self, method, path, data=None, params=None):
        headers = {}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        query = ""
        if params:
            query = "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        url = f"/{path.lstrip('/')}{query}"
        fn = getattr(self.ninja_client, method.lower())
        kwargs = {"headers": headers}
        if data is not None:
            kwargs["json"] = data
        res = fn(url, **kwargs)
        if res.status_code >= 400:
            raise RuntimeError(f"Davai API error ({res.status_code}): {res.content.decode()}")
        return res.json()

@pytest.mark.django_db
class TestMCPWithApiClient:
    def test_mcp_tools_via_api_client(self, ninja_client, test_user, test_project, test_api_key):
        _, raw_key = test_api_key
        client = InProcessDavaiClient(ninja_client, api_key=raw_key)
        set_client(client)

        # 1. Verify get_me through client
        me = client.get_me()
        assert me["username"] == test_user.username

        # 2. Create work item via MCP tool
        created = create_work_item(
            title="MCP Tool Generated Ticket",
            descr="Created through MCP API Client",
            priority="HIGH",
            status="todo",
            project_key=test_project.key
        )
        assert created["title"] == "MCP Tool Generated Ticket"
        assert created["key"].startswith("DAV-")
        item_key = created["key"]

        # 3. Fetch single item via MCP tool
        fetched = get_work_item(item_key)
        assert fetched["key"] == item_key
        assert fetched["priority"] == "HIGH"
        assert fetched["descr"] == "Created through MCP API Client"

        # 4. Update item via MCP tool
        updated = update_work_item(key=item_key, status="done")
        assert updated["status"] == "done"

        # 5. Set technical context via MCP tool
        ctx = set_work_item_context(key=item_key, t="# Technical Context\nVerified by MCP.")
        assert ctx["t"] == "# Technical Context\nVerified by MCP."

        # 6. Log progress with proof via MCP tool
        prog = log_work_item_progress(key=item_key, t="Shipped MCP integration", proof="git:sha-987abc", status="COMPLETED")
        assert prog["proof"] == "git:sha-987abc"
        assert prog["status"] == "COMPLETED"

        # 7. List items via MCP tool
        items = list_work_items(project_key=test_project.key)
        assert any(i["key"] == item_key for i in items)

        # 8. Create a Release and a Sprint, associate item
        rel = Release.objects.create(project=test_project, name="v1.0.0", description="First stable release")
        sp = Sprint.objects.create(project=test_project, release=rel, name="Sprint 1", description="Initial sprint")
        update_work_item(key=item_key, sprint_id=sp.id, release_id=rel.id)

        # 9. List sprints and releases via MCP tools
        sprints = list_sprints(project_key=test_project.key)
        assert len(sprints) >= 1
        assert any(s["name"] == "Sprint 1" and s["release_id"] == rel.id for s in sprints)

        releases = list_releases(project_key=test_project.key)
        assert len(releases) >= 1
        assert any(r["name"] == "v1.0.0" for r in releases)

        # 10. Project summary with sprint and release integration
        summary = get_project_summary(project_key=test_project.key)
        assert summary["project"] == test_project.key
        assert summary["total_items"] >= 1
        assert summary["done"] >= 1
        assert summary["sprints_count"] >= 1
        assert summary["releases_count"] >= 1
        assert "sprints" in summary
        assert "releases" in summary
        assert any(s["name"] == "Sprint 1" and s["done"] >= 1 for s in summary["sprints"])
        assert any(r["name"] == "v1.0.0" and "Sprint 1" in r["linked_sprints"] for r in summary["releases"])

        # 11. Board state resource
        board_state = get_board_state()
        assert "MCP Tool Generated Ticket" in board_state

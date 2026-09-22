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
    update_work_item_progress,
    delete_work_item_progress,
    list_sprints,
    create_sprint,
    update_sprint,
    list_releases,
    create_release,
    update_release,
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
            description="Created through MCP API Client",
            priority="HIGH",
            status="todo",
            project_key=test_project.key
        )
        assert created["title"] == "MCP Tool Generated Ticket"
        assert created["description"] == "Created through MCP API Client"
        assert created["key"].startswith("DAV-")
        assert created["active_assignee"] == test_user.username
        item_key = created["key"]

        # 2b. Create work item with active_assignee_username="" (explicit unassigned)
        created_unassigned = create_work_item(
            title="Unassigned Ticket",
            active_assignee_username="",
            project_key=test_project.key
        )
        assert created_unassigned["active_assignee"] is None

        # 2c. Create work item with initial LLM context and verify semantic guidelines
        assert "description (Human Request)" in create_work_item.__doc__
        assert "context (LLM Technical Plan)" in create_work_item.__doc__
        created_with_ctx = create_work_item(
            title="Ticket with Initial Context",
            description="Original human request",
            context="# Initial LLM Analysis\nArchitecture plan and constraints.",
            project_key=test_project.key
        )
        assert created_with_ctx["description"] == "Original human request"
        assert created_with_ctx["context"] is not None
        assert created_with_ctx["context"]["summary"] == "# Initial LLM Analysis\nArchitecture plan and constraints."
        assert created_with_ctx["context"]["updated_by"] == test_user.username

        # 3. Fetch single item via MCP tool
        fetched = get_work_item(item_key)
        assert fetched["key"] == item_key
        assert fetched["priority"] == "HIGH"
        assert fetched["description"] == "Created through MCP API Client"

        # 4. Update item via MCP tool (rejects 'done', accepts valid progress statuses)
        with pytest.raises(ValueError, match="The 'done' status can only be set by a human"):
            update_work_item(key=item_key, status="done")

        updated = update_work_item(key=item_key, status="planned")
        assert updated["status"] == "planned"

        # 5. Set technical context via MCP tool (contract verification)
        assert "NO VERSIONING" in set_work_item_context.__doc__
        assert "LATEST FACTS ONLY" in set_work_item_context.__doc__
        assert "overwrites" in set_work_item_context.__doc__.lower()

        ctx1 = set_work_item_context(key=item_key, summary="# Technical Context\nInitial constraints.")
        assert ctx1["summary"] == "# Technical Context\nInitial constraints."
        assert ctx1["updated_by"] == test_user.username
        assert "timestamp" in ctx1

        # Re-set context to verify complete replacement, not append
        ctx2 = set_work_item_context(key=item_key, summary="# Technical Context v2\nOverwritten facts.")
        assert ctx2["summary"] == "# Technical Context v2\nOverwritten facts."
        assert "Initial constraints" not in ctx2["summary"]

        fetched_after_ctx = get_work_item(key=item_key)
        assert fetched_after_ctx["context"]["summary"] == "# Technical Context v2\nOverwritten facts."
        assert "Initial constraints" not in fetched_after_ctx["context"]["summary"]
        assert fetched_after_ctx["context"]["updated_by"] == test_user.username
        assert "timestamp" in fetched_after_ctx["context"]

        # 6. Log progress with proof via MCP tool (rejects 'done', accepts valid lowercase)
        with pytest.raises(ValueError, match="The 'done' status can only be set by a human"):
            log_work_item_progress(key=item_key, summary="Try done", status="done")

        prog = log_work_item_progress(key=item_key, summary="Shipped MCP integration", proof="git:sha-987abc", status="step completed")
        assert prog["summary"] == "Shipped MCP integration"
        assert prog["proof"] == "git:sha-987abc"
        assert prog["status"] == "step completed"
        assert prog["created_by"] == test_user.username
        assert "created_at" in prog
        prog_id = prog["id"]

        # Update progress entry via MCP tool
        with pytest.raises(ValueError, match="The 'done' status can only be set by a human"):
            update_work_item_progress(key=item_key, progress_id=prog_id, status="done")

        updated_prog = update_work_item_progress(
            key=item_key,
            progress_id=prog_id,
            summary="Shipped MCP integration with tests",
            proof="git:sha-final",
            status="awaiting review"
        )
        assert updated_prog["summary"] == "Shipped MCP integration with tests"
        assert updated_prog["proof"] == "git:sha-final"
        assert updated_prog["status"] == "awaiting review"
        assert updated_prog["created_by"] == test_user.username
        assert updated_prog["updated_by"] == test_user.username
        assert updated_prog["updated_at"] is not None

        # Delete progress entry via MCP tool
        del_prog = delete_work_item_progress(key=item_key, progress_id=prog_id)
        assert del_prog["success"] is True

        # Clear any remaining progress entries and verify work item reverts to 'todo'
        for remaining in get_work_item(key=item_key)["progress"]:
            delete_work_item_progress(key=item_key, progress_id=remaining["id"])

        # Verify get_work_item has 0 progress entries and status is 'todo'
        fetched_after_del = get_work_item(key=item_key)
        assert len(fetched_after_del["progress"]) == 0
        assert fetched_after_del["status"] == "todo"

        # 7. List items via MCP tool
        items = list_work_items(project_key=test_project.key)
        assert any(i["key"] == item_key for i in items)

        # 8. Create a Release and a Sprint, associate item
        rel = Release.objects.create(project=test_project, name="v1.0.0", description="First stable release")
        sp = Sprint.objects.create(project=test_project, release=rel, name="Sprint 1", description="Initial sprint")
        # Human verifies and sets item to done via progress
        from tracker.models import Progress as ProgressModel, WorkItem as WorkItemModel
        item_obj = WorkItemModel.objects.get(key=item_key)
        ProgressModel.objects.create(work_item=item_obj, summary="Human verified and closed", status="done", created_by=test_user)

        update_work_item(key=item_key, sprint_id=sp.id, release_id=rel.id)

        # Create work item directly with sprint_id and release_id
        item_with_sprint = create_work_item(
            title="Item in sprint",
            project_key=test_project.key,
            sprint_id=sp.id,
            release_id=rel.id
        )
        assert item_with_sprint["sprint_id"] == sp.id
        assert item_with_sprint["release_id"] == rel.id

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

        # 12. Create and update sprint with dates via MCP tools
        mcp_sprint = create_sprint(
            name="Sprint 2 - MCP",
            project_key=test_project.key,
            description="Created via MCP tool",
            start_date="2026-10-01",
            end_date="2026-10-15"
        )
        assert mcp_sprint["name"] == "Sprint 2 - MCP"
        assert mcp_sprint["start_date"].startswith("2026-10-01")
        assert mcp_sprint["end_date"].startswith("2026-10-15")

        # Update sprint dates and clear end_date
        updated_sp = update_sprint(
            sprint_id=mcp_sprint["id"],
            project_key=test_project.key,
            start_date="2026-10-05",
            end_date="clear"
        )
        assert updated_sp["start_date"].startswith("2026-10-05")
        assert updated_sp["end_date"] is None

        # 13. Create and update release with dates via MCP tools
        mcp_release = create_release(
            name="v2.0.0",
            project_key=test_project.key,
            description="Major release via MCP",
            start_date="2026-10-01",
            end_date="2026-11-01"
        )
        assert mcp_release["name"] == "v2.0.0"
        assert mcp_release["start_date"].startswith("2026-10-01")
        assert mcp_release["end_date"].startswith("2026-11-01")

        # Clear start_date and update end_date
        updated_rel = update_release(
            release_id=mcp_release["id"],
            project_key=test_project.key,
            start_date="",
            end_date="2026-12-01"
        )
        assert updated_rel["start_date"] is None
        assert updated_rel["end_date"].startswith("2026-12-01")

        # 14. Create work item with dates and update/clear dates via MCP
        dated_item = create_work_item(
            title="Work item with dates",
            project_key=test_project.key,
            start_date="2026-10-02",
            target_date="2026-10-10"
        )
        assert dated_item["start_date"].startswith("2026-10-02")
        assert dated_item["target_date"].startswith("2026-10-10")

        # Clear target date and update start date
        updated_dated_item = update_work_item(
            key=dated_item["key"],
            start_date="2026-10-03",
            target_date="null"
        )
        assert updated_dated_item["start_date"].startswith("2026-10-03")
        assert updated_dated_item["target_date"] is None

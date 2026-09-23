import os
import sys
import json
import argparse
import asyncio
from typing import Optional, List, Dict, Any
from mcp.server.mcpserver import MCPServer
from mcp_server.client import DavaiClient

mcp_server = MCPServer(
    name="davai-work-tracker",
    version="1.0.0",
    description="Model Context Protocol interface for Davai Jira-like work management app via REST API Client"
)

_client: Optional[DavaiClient] = None

def get_client() -> DavaiClient:
    global _client
    if _client is None:
        _client = DavaiClient()
    return _client

def set_client(client: DavaiClient):
    global _client
    _client = client

MCP_ALLOWED_STATUSES = (
    "todo",
    "planned",
    "step completed",
    "blocked",
    "awaiting review",
    "cancelled",
    "failed",
)

@mcp_server.tool()
def list_work_items(status: Optional[str] = None, project_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List work items in Davai.
    Omits description, context, and progress entries for brevity (use get_work_item to fetch complete details for a specific item).
    Args:
        status: Optional status filter ('todo', 'planned', 'step completed', 'blocked', 'failed', 'cancelled', 'awaiting review', 'done').
        project_key: Optional project key filter (e.g. 'DAV').
    """
    return get_client().list_work_items(status=status, project_key=project_key)

@mcp_server.tool()
def get_work_item(key: str) -> Dict[str, Any]:
    """
    Retrieve details of a specific work item by key (e.g. 'DAV-1'), including subtasks, context, and progress entries.
    Args:
        key: The work item key or ID.
    """
    return get_client().get_work_item(key=key)

@mcp_server.tool()
def create_work_item(
    title: str,
    description: str = "",
    context: Optional[str] = None,
    priority: str = "MEDIUM",
    status: Optional[str] = None,
    project_key: str = "DAV",
    active_assignee_username: Optional[str] = None,
    parent_key: Optional[str] = None,
    sprint_id: Optional[int] = None,
    release_id: Optional[int] = None,
    start_date: Optional[str] = None,
    target_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new work item in Davai.

    Field Semantics & Guidelines:
    - description (Human Request): Original task description and requirements from the human user (user story, prompt, bug report). Preserve user intent here without replacing it with agent analysis.
    - context (LLM Technical Plan): The agent's technical analysis, architectural investigation, decisions, constraints, or implementation plan deduced by the model (SKILL.md-style markdown technical context). Can be initialized here or updated later via set_work_item_context.

    Args:
        title: Title of the task.
        description: Original task requirements/description from human input.
        context: Optional initial technical context, analysis, or implementation plan deduced by the LLM agent (markdown supported).
        priority: Priority level ('LOW', 'MEDIUM', 'HIGH'). Defaults to 'MEDIUM'.
        status: Status ('todo', 'planned', 'step completed', 'blocked', 'failed', 'cancelled', 'awaiting review'). Defaults to 'todo'. Note: 'done' is not permitted via MCP.
        project_key: Target project key (defaults to 'DAV').
        active_assignee_username: Optional username of assigned user. Defaults to the current user (creator) if omitted. Pass empty string to leave unassigned.
        parent_key: Optional parent work item key for subtasks (e.g. 'DAV-1').
        sprint_id: Optional sprint ID to assign to.
        release_id: Optional release ID to tag with.
        start_date: Optional start date (YYYY-MM-DD or ISO format).
        target_date: Optional target completion date (YYYY-MM-DD or ISO format).
    """
    if status is not None:
        clean_status = status.strip().lower()
        if clean_status == "done":
            raise ValueError("The 'done' status can only be set by a human via the frontend.")
        if clean_status not in MCP_ALLOWED_STATUSES:
            raise ValueError(f"Invalid status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_STATUSES)}.")
        status = clean_status

    return get_client().create_work_item(
        title=title,
        description=description,
        priority=priority,
        status=status,
        project_key=project_key,
        active_assignee_username=active_assignee_username,
        parent_key=parent_key,
        sprint_id=sprint_id,
        release_id=release_id,
        start_date=start_date,
        target_date=target_date,
        context=context
    )

@mcp_server.tool()
def update_work_item(
    key: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    active_assignee_username: Optional[str] = None,
    parent_key: Optional[str] = None,
    sprint_id: Optional[int] = None,
    release_id: Optional[int] = None,
    start_date: Optional[str] = None,
    target_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update fields of an existing work item, including setting or clearing dates.
    Args:
        key: Work item key (e.g. 'DAV-1').
        title: Optional new title.
        description: Optional new description.
        status: Optional new status ('todo', 'planned', 'step completed', 'blocked', 'failed', 'cancelled', 'awaiting review'). Note: 'done' is not permitted via MCP.
        priority: Optional new priority ('LOW', 'MEDIUM', 'HIGH').
        active_assignee_username: Optional username to assign to. Pass empty string to unassign.
        parent_key: Optional parent key to reparent or nest this work item.
        sprint_id: Optional sprint ID to assign to. Pass 0 to remove from sprint.
        release_id: Optional release ID to tag with. Pass 0 to remove from release.
        start_date: Optional start date (YYYY-MM-DD or ISO format). Pass empty string '' or 'clear' to clear/unset.
        target_date: Optional target date (YYYY-MM-DD or ISO format). Pass empty string '' or 'clear' to clear/unset.
    """
    kwargs: Dict[str, Any] = {}
    if title is not None:
        kwargs["title"] = title
    if description is not None:
        kwargs["description"] = description
    if status is not None:
        clean_status = status.strip().lower()
        if clean_status == "done":
            raise ValueError("The 'done' status can only be set by a human via the frontend.")
        if clean_status not in MCP_ALLOWED_STATUSES:
            raise ValueError(f"Invalid status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_STATUSES)}.")
        kwargs["status"] = clean_status
    if priority is not None:
        kwargs["priority"] = priority
    if active_assignee_username is not None:
        kwargs["active_assignee_username"] = active_assignee_username
    if parent_key is not None:
        kwargs["parent_key"] = parent_key
    if sprint_id is not None:
        kwargs["sprint_id"] = sprint_id
    if release_id is not None:
        kwargs["release_id"] = release_id
    if start_date is not None:
        kwargs["start_date"] = start_date
    if target_date is not None:
        kwargs["target_date"] = target_date
    return get_client().update_work_item(key=key, **kwargs)

@mcp_server.tool()
def set_work_item_context(key: str, summary: str) -> Dict[str, Any]:
    """
    Set or overwrite the unversioned, SKILL.md-style technical context for a work item.

    Contract & Semantics:
    - NO VERSIONING: Overwrites the previous context completely. A re-set replaces the existing value (does not append), and the previous value is gone.
    - LATEST FACTS ONLY: Represents the single, always-current technical specifications and facts written for an LLM agent or developer to read before working on the task.
    - STATE vs TIMELINE: Place architecture, constraints, interfaces, and current decisions here — NOT a changelog or chronological progress log (use log_work_item_progress for timeline/milestones). Edit or delete stale statements rather than appending.
    - STALENESS: Returns updated_by and timestamp so readers can evaluate freshness and staleness.

    Args:
        key: Work item key (e.g. 'DAV-1').
        summary: Complete, current markdown context and technical specifications (replaces any existing context).
    """
    return get_client().set_work_item_context(key=key, summary=summary)

@mcp_server.tool()
def log_work_item_progress(
    key: str,
    summary: str,
    proof: str = "",
    status: str = "step completed"
) -> Dict[str, Any]:
    """
    Log a progress step, decision, or completed milestone for a work item.
    Args:
        key: Work item key (e.g. 'DAV-1').
        summary: Summary of the step completed, decision made, or current obstacle.
        proof: If the work is version controlled, this should be a feature branch or a git sha; if not, then a link to the destination or artifact.
        status: Step status ('todo', 'planned', 'step completed', 'blocked', 'failed', 'cancelled', 'awaiting review'). Defaults to 'step completed'. Note: 'done' is reserved for human verification in the frontend and is refused by MCP.
    """
    clean_status = (status or "step completed").strip().lower()
    if clean_status == "done":
        raise ValueError("The 'done' status can only be set by a human via the frontend.")
    if clean_status not in MCP_ALLOWED_STATUSES:
        raise ValueError(f"Invalid status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_STATUSES)}.")
    return get_client().log_work_item_progress(key=key, summary=summary, proof=proof, status=clean_status)

@mcp_server.tool()
def update_work_item_progress(
    key: str,
    progress_id: int,
    summary: Optional[str] = None,
    proof: Optional[str] = None,
    status: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update an existing progress entry for a work item (e.g. to fix a typo or update proof/status).
    Args:
        key: Work item key (e.g. 'DAV-1').
        progress_id: ID of the progress entry to update.
        summary: Optional new summary or description of the progress/step.
        proof: Optional new proof (git sha, feature branch, or artifact link).
        status: Optional new status ('todo', 'planned', 'step completed', 'blocked', 'failed', 'cancelled', 'awaiting review'). Note: 'done' is reserved for human verification in the frontend and is refused by MCP.
    """
    kwargs: Dict[str, Any] = {}
    if summary is not None:
        kwargs["summary"] = summary
    if proof is not None:
        kwargs["proof"] = proof
    if status is not None:
        clean_status = status.strip().lower()
        if clean_status == "done":
            raise ValueError("The 'done' status can only be set by a human via the frontend.")
        if clean_status not in MCP_ALLOWED_STATUSES:
            raise ValueError(f"Invalid status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_STATUSES)}.")
        kwargs["status"] = clean_status
    return get_client().update_work_item_progress(key=key, progress_id=progress_id, **kwargs)

@mcp_server.tool()
def delete_work_item_progress(key: str, progress_id: int) -> Dict[str, Any]:
    """
    Delete an existing progress entry from a work item.
    Args:
        key: Work item key (e.g. 'DAV-1').
        progress_id: ID of the progress entry to delete.
    """
    return get_client().delete_work_item_progress(key=key, progress_id=progress_id)

@mcp_server.tool()
def list_sprints(project_key: str = "DAV") -> List[Dict[str, Any]]:
    """
    List all sprints for a project.
    Args:
        project_key: Project key (default 'DAV').
    """
    return get_client().list_sprints(project_key=project_key)

@mcp_server.tool()
def list_releases(project_key: str = "DAV") -> List[Dict[str, Any]]:
    """
    List all releases for a project.
    Args:
        project_key: Project key (default 'DAV').
    """
    return get_client().list_releases(project_key=project_key)

@mcp_server.tool()
def create_sprint(
    name: str,
    project_key: str = "DAV",
    description: str = "",
    release_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new sprint for a project.
    Args:
        name: Sprint name.
        project_key: Project key (default 'DAV').
        description: Optional sprint objective / description.
        release_id: Optional release ID to associate with.
        start_date: Optional start date (YYYY-MM-DD or ISO format).
        end_date: Optional end date (YYYY-MM-DD or ISO format).
    """
    return get_client().create_sprint(
        name=name,
        project_key=project_key,
        description=description,
        release_id=release_id,
        start_date=start_date,
        end_date=end_date
    )

@mcp_server.tool()
def update_sprint(
    sprint_id: int,
    project_key: str = "DAV",
    name: Optional[str] = None,
    description: Optional[str] = None,
    release_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update fields of an existing sprint, including setting or clearing dates.
    Args:
        sprint_id: Sprint ID to update.
        project_key: Project key (default 'DAV').
        name: Optional new name.
        description: Optional new description.
        release_id: Optional release ID to associate with (pass 0 to dissociate).
        start_date: Optional start date (YYYY-MM-DD or ISO format). Pass empty string '' or 'clear' to clear/unset.
        end_date: Optional end date (YYYY-MM-DD or ISO format). Pass empty string '' or 'clear' to clear/unset.
    """
    kwargs: Dict[str, Any] = {}
    if name is not None:
        kwargs["name"] = name
    if description is not None:
        kwargs["description"] = description
    if release_id is not None:
        kwargs["release_id"] = release_id
    if start_date is not None:
        kwargs["start_date"] = start_date
    if end_date is not None:
        kwargs["end_date"] = end_date
    return get_client().update_sprint(
        sprint_id=sprint_id,
        project_key=project_key,
        **kwargs
    )

@mcp_server.tool()
def create_release(
    name: str,
    project_key: str = "DAV",
    description: str = "",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new release milestone.
    Args:
        name: Release name/version (e.g. 'v1.0.0').
        project_key: Project key (default 'DAV').
        description: Optional release scope / notes.
        start_date: Optional start date (YYYY-MM-DD or ISO format).
        end_date: Optional end date (YYYY-MM-DD or ISO format).
    """
    return get_client().create_release(
        name=name,
        project_key=project_key,
        description=description,
        start_date=start_date,
        end_date=end_date
    )

@mcp_server.tool()
def update_release(
    release_id: int,
    project_key: str = "DAV",
    name: Optional[str] = None,
    description: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update fields of an existing release milestone, including setting or clearing dates.
    Args:
        release_id: Release ID to update.
        project_key: Project key (default 'DAV').
        name: Optional new name.
        description: Optional new description.
        start_date: Optional start date (YYYY-MM-DD or ISO format). Pass empty string '' or 'clear' to clear/unset.
        end_date: Optional end date (YYYY-MM-DD or ISO format). Pass empty string '' or 'clear' to clear/unset.
    """
    kwargs: Dict[str, Any] = {}
    if name is not None:
        kwargs["name"] = name
    if description is not None:
        kwargs["description"] = description
    if start_date is not None:
        kwargs["start_date"] = start_date
    if end_date is not None:
        kwargs["end_date"] = end_date
    return get_client().update_release(
        release_id=release_id,
        project_key=project_key,
        **kwargs
    )

@mcp_server.tool()
def get_project_summary(project_key: str = "DAV") -> Dict[str, Any]:
    """
    Get a statistical summary of the Davai project board, including work item, sprint, and release breakdowns.
    Args:
        project_key: Project key (default 'DAV').
    """
    return get_client().get_project_summary(project_key=project_key)

@mcp_server.resource("davai://board/state")
def get_board_state() -> str:
    """Read the complete real-time JSON state of the Davai work board."""
    items = get_client().list_work_items()
    return json.dumps(items, indent=2)

def main():
    parser = argparse.ArgumentParser(description="Davai MCP Server (Stdio Mode)")
    parser.add_argument("--api-key", help="Davai API Key for authentication (or set DAVAI_API_KEY env var)")
    parser.add_argument("--api-url", help="Davai API base URL (default: http://127.0.0.1:8000/api)")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("DAVAI_API_KEY")
    api_url = args.api_url or os.environ.get("DAVAI_API_URL")

    client = DavaiClient(base_url=api_url, api_key=api_key)
    set_client(client)

    if api_key:
        try:
            me = client.get_me()
            sys.stderr.write(f"Davai MCP: Authenticated as '{me.get('username', 'unknown')}' via API client.\n")
        except Exception as e:
            sys.stderr.write(f"ERROR: Failed to authenticate with Davai API: {e}\n")
            sys.exit(1)
    else:
        sys.stderr.write("Davai MCP: Running in unauthenticated mode.\n")

    asyncio.run(mcp_server.run_stdio_async())

if __name__ == "__main__":
    main()

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
    "in progress",
    "blocked",
    "review",
    "cancelled",
)

@mcp_server.tool()
def list_work_items(status: Optional[str] = None, project_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List work items in Davai.
    Includes key, title, status, priority, assignees, subtasks list (key and title), and metadata.
    Omits description, context, and progress entries for brevity (use get_work_item to fetch complete details for a specific item).
    Args:
        status: Optional status filter ('todo', 'planned', 'in progress', 'blocked', 'review', 'cancelled', 'done').
        project_key: Optional project key filter. Note: There is no default project; provide the project key if known from the user, or ask the user which project to use.
    """
    return get_client().list_work_items(status=status, project_key=project_key)

@mcp_server.tool()
def get_work_item(key: str) -> Dict[str, Any]:
    """
    Retrieve details of a specific work item by key (e.g. 'DAV-1'), including subtasks (key and title), context, and progress entries.
    Args:
        key: The work item key or ID.
    """
    return get_client().get_work_item(key=key)

@mcp_server.tool()
def create_work_item(
    title: str,
    project_key: str,
    description: str = "",
    context: Optional[str] = None,
    priority: str = "MEDIUM",
    status: Optional[str] = None,
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
        project_key: Target project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
        description: Original task requirements/description from human input.
        context: Optional initial technical context, analysis, or implementation plan deduced by the LLM agent (markdown supported).
        priority: Priority level ('LOW', 'MEDIUM', 'HIGH'). Defaults to 'MEDIUM'.
        status: Status ('todo', 'planned', 'in progress', 'blocked', 'review', 'cancelled'). Defaults to 'todo'. Note: 'done' is not permitted via MCP.
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
        project_key=project_key,
        description=description,
        priority=priority,
        status=status,
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
        status: Optional new status ('todo', 'planned', 'in progress', 'blocked', 'review', 'cancelled'). Note: 'done' is not permitted via MCP.
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
    agent_id: str,
    proof: str = "",
    status: str = "in progress",
    hostname: str = "",
) -> Dict[str, Any]:
    """
    Log a progress step, decision, or completed milestone for a work item.
    Args:
        key: Work item key (e.g. 'DAV-1').
        summary: Summary of the step completed, decision made, or current obstacle.
        agent_id: Required agent/model/session identifier in the format '<agent>/<model>/<session-id>' (e.g. 'claude-code/claude-sonnet-4-5/sess-123').
        proof: If the work is version controlled, this should be a feature branch or a git sha; if not, then a link to the destination or artifact.
        status: Step status ('todo', 'planned', 'in progress', 'blocked', 'review', 'cancelled'). Defaults to 'in progress'. Note: 'done' is reserved for human verification in the frontend and is refused by MCP.
        hostname: Optional hostname of the machine or environment where the work is being performed.
    """
    clean_agent_id = (agent_id or "").strip()
    if not clean_agent_id:
        raise ValueError("The 'agent_id' argument is required when logging progress via MCP.")
    clean_hostname = (hostname or "").strip()
    clean_status = (status or "in progress").strip().lower()
    if clean_status == "done":
        raise ValueError("The 'done' status can only be set by a human via the frontend.")
    if clean_status not in MCP_ALLOWED_STATUSES:
        raise ValueError(f"Invalid status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_STATUSES)}.")
    return get_client().log_work_item_progress(
        key=key,
        summary=summary,
        agent_id=clean_agent_id,
        proof=proof,
        status=clean_status,
        hostname=clean_hostname,
    )

@mcp_server.tool()
def update_work_item_progress(
    key: str,
    progress_id: int,
    summary: Optional[str] = None,
    agent_id: Optional[str] = None,
    proof: Optional[str] = None,
    status: Optional[str] = None,
    hostname: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Update an existing progress entry for a work item (e.g. to fix a typo or update proof/status).
    Args:
        key: Work item key (e.g. 'DAV-1').
        progress_id: ID of the progress entry to update.
        summary: Optional new summary or description of the progress/step.
        agent_id: Optional updated agent/model/session identifier (e.g. '<agent>/<model>/<session-id>').
        proof: Optional new proof (git sha, feature branch, or artifact link).
        status: Optional new status ('todo', 'planned', 'in progress', 'blocked', 'review', 'cancelled'). Note: 'done' is reserved for human verification in the frontend and is refused by MCP.
        hostname: Optional updated hostname of the machine or environment.
    """
    kwargs: Dict[str, Any] = {}
    if summary is not None:
        kwargs["summary"] = summary
    if agent_id is not None:
        kwargs["agent_id"] = agent_id
    if hostname is not None:
        kwargs["hostname"] = hostname
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
def list_sprints(project_key: str) -> List[Dict[str, Any]]:
    """
    List all sprints for a project.
    Args:
        project_key: Project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
    """
    return get_client().list_sprints(project_key=project_key)

@mcp_server.tool()
def list_releases(project_key: str) -> List[Dict[str, Any]]:
    """
    List all releases for a project.
    Args:
        project_key: Project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
    """
    return get_client().list_releases(project_key=project_key)

MCP_ALLOWED_SPRINT_RELEASE_STATUSES = (
    "planned",
    "in progress",
)

HUMAN_ONLY_SPRINT_RELEASE_STATUSES = (
    "done",
)

@mcp_server.tool()
def create_sprint(
    name: str,
    project_key: str,
    description: str = "",
    status: str = "planned",
    release_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new sprint for a project.
    Args:
        name: Sprint name.
        project_key: Project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
        description: Optional sprint objective / description.
        status: Initial sprint status ('planned', 'in progress'). Defaults to 'planned'. Note: 'done' is a human-only status via the frontend.
        release_id: Optional release ID to associate with.
        start_date: Optional start date (YYYY-MM-DD or ISO format).
        end_date: Optional end date (YYYY-MM-DD or ISO format).
    """
    clean_status = (status or "planned").strip().lower().replace("_", " ")
    if clean_status in HUMAN_ONLY_SPRINT_RELEASE_STATUSES:
        raise ValueError(f"The '{clean_status}' status can only be set by a human via the frontend.")
    if clean_status not in MCP_ALLOWED_SPRINT_RELEASE_STATUSES:
        raise ValueError(
            f"Invalid sprint status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_SPRINT_RELEASE_STATUSES)}."
        )
    return get_client().create_sprint(
        name=name,
        project_key=project_key,
        description=description,
        status=clean_status,
        release_id=release_id,
        start_date=start_date,
        end_date=end_date
    )

@mcp_server.tool()
def update_sprint(
    sprint_id: int,
    project_key: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    release_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update fields of an existing sprint, including setting or clearing dates.
    Args:
        sprint_id: Sprint ID to update.
        project_key: Project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
        name: Optional new name.
        description: Optional new description.
        status: Optional new status ('planned', 'in progress'). Note: 'done' is a human-only status via the frontend.
        release_id: Optional release ID to associate with (pass 0 to dissociate).
        start_date: Optional start date (YYYY-MM-DD or ISO format). Pass empty string '' or 'clear' to clear/unset.
        end_date: Optional end date (YYYY-MM-DD or ISO format). Pass empty string '' or 'clear' to clear/unset.
    """
    kwargs: Dict[str, Any] = {}
    if name is not None:
        kwargs["name"] = name
    if description is not None:
        kwargs["description"] = description
    if status is not None:
        clean_status = status.strip().lower().replace("_", " ")
        if clean_status in HUMAN_ONLY_SPRINT_RELEASE_STATUSES:
            raise ValueError(f"The '{clean_status}' status can only be set by a human via the frontend.")
        if clean_status not in MCP_ALLOWED_SPRINT_RELEASE_STATUSES:
            raise ValueError(
                f"Invalid sprint status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_SPRINT_RELEASE_STATUSES)}."
            )
        kwargs["status"] = clean_status
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
    project_key: str,
    description: str = "",
    status: str = "planned",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new release milestone.
    Args:
        name: Release name/version (e.g. 'v1.0.0').
        project_key: Project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
        description: Optional release scope / notes.
        status: Initial release status ('planned', 'in progress'). Defaults to 'planned'. Note: 'done' is a human-only status via the frontend.
        start_date: Optional start date (YYYY-MM-DD or ISO format).
        end_date: Optional end date (YYYY-MM-DD or ISO format).
    """
    clean_status = (status or "planned").strip().lower().replace("_", " ")
    if clean_status in HUMAN_ONLY_SPRINT_RELEASE_STATUSES:
        raise ValueError(f"The '{clean_status}' status can only be set by a human via the frontend.")
    if clean_status not in MCP_ALLOWED_SPRINT_RELEASE_STATUSES:
        raise ValueError(
            f"Invalid release status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_SPRINT_RELEASE_STATUSES)}."
        )
    return get_client().create_release(
        name=name,
        project_key=project_key,
        description=description,
        status=clean_status,
        start_date=start_date,
        end_date=end_date
    )

@mcp_server.tool()
def update_release(
    release_id: int,
    project_key: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update fields of an existing release milestone, including setting or clearing dates.
    Args:
        release_id: Release ID to update.
        project_key: Project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
        name: Optional new name.
        description: Optional new description.
        status: Optional new status ('planned', 'in progress'). Note: 'done' is a human-only status via the frontend.
        start_date: Optional start date (YYYY-MM-DD or ISO format). Pass empty string '' or 'clear' to clear/unset.
        end_date: Optional end date (YYYY-MM-DD or ISO format). Pass empty string '' or 'clear' to clear/unset.
    """
    kwargs: Dict[str, Any] = {}
    if name is not None:
        kwargs["name"] = name
    if description is not None:
        kwargs["description"] = description
    if status is not None:
        clean_status = status.strip().lower().replace("_", " ")
        if clean_status in HUMAN_ONLY_SPRINT_RELEASE_STATUSES:
            raise ValueError(f"The '{clean_status}' status can only be set by a human via the frontend.")
        if clean_status not in MCP_ALLOWED_SPRINT_RELEASE_STATUSES:
            raise ValueError(
                f"Invalid release status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_SPRINT_RELEASE_STATUSES)}."
            )
        kwargs["status"] = clean_status
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
def get_project_summary(project_key: str) -> Dict[str, Any]:
    """
    Get a statistical summary of a project board, including work item, sprint, and release breakdowns.
    Args:
        project_key: Project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
    """
    return get_client().get_project_summary(project_key=project_key)

MCP_ALLOWED_INCIDENT_STATUSES = (
    "reported",
    "ongoing",
)

HUMAN_ONLY_INCIDENT_STATUSES = (
    "done",
    "no longer relevant",
)

MCP_ALLOWED_MONITORING_LOG_STATUSES = (
    "ok",
    "error",
)

@mcp_server.tool()
def create_incident(
    title: str,
    project_key: str,
    cause: str = "",
    investigation_note: str = "",
    status: str = "reported",
    work_item_keys: Optional[List[str]] = None,
    monitoring_log_ids: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    Create a new incident in Davai.
    Args:
        title: Short title summarizing the incident.
        project_key: Project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
        cause: Investigation cause and details of the incident.
        investigation_note: Quick investigation note (specific checks to confirm/deny whether this incident is happening again).
        status: Initial incident status ('reported', 'ongoing'). Defaults to 'reported'. Note: 'done' and 'no longer relevant' are human-only statuses.
        work_item_keys: Optional list of work item keys (e.g. ['DAV-1']) linked for mitigation/addressing the incident.
        monitoring_log_ids: Optional list of monitoring log IDs or keys (e.g. [1, 'DAV-LOG-2']) linked to this incident.
    """
    clean_status = (status or "reported").strip().lower().replace("_", " ")
    if clean_status in HUMAN_ONLY_INCIDENT_STATUSES:
        raise ValueError(f"The '{clean_status}' status can only be set by a human via the frontend.")
    if clean_status not in MCP_ALLOWED_INCIDENT_STATUSES:
        raise ValueError(
            f"Invalid incident status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_INCIDENT_STATUSES)}."
        )
    return get_client().create_incident(
        title=title,
        project_key=project_key,
        cause=cause,
        investigation_note=investigation_note,
        status=clean_status,
        work_item_keys=work_item_keys,
        monitoring_log_ids=monitoring_log_ids,
    )

@mcp_server.tool()
def get_incident(incident_id: str) -> Dict[str, Any]:
    """
    Retrieve details of an incident by key (e.g. 'DAV-INC-1') or numeric ID.
    Returns incident details, linked work items, and linked monitoring log IDs/keys (without log run descriptions; use get_monitoring_log to fetch full log content).
    Args:
        incident_id: The incident key (e.g. 'DAV-INC-1') or numeric ID.
    """
    return get_client().get_incident(incident_id=incident_id)

@mcp_server.tool()
def search_incidents(
    project_key: str,
    query: str = "",
    mode: str = "hybrid",
    status: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Search incidents using semantic/vector/hybrid search.
    Note: Incidents marked 'no longer relevant' are always excluded from all searches.
    Returns matching incidents with linked monitoring_log_ids (without log details).
    Args:
        project_key: Project key filter. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
        query: Search query string.
        mode: Search mode ('hybrid', 'vector', 'keyword'). Defaults to 'hybrid'.
        status: Optional status filter ('reported', 'ongoing', 'done').
        limit: Max results to return (default 20).
    """
    return get_client().search_incidents(
        query=query,
        project_key=project_key,
        mode=mode,
        status=status,
        limit=limit,
    )

@mcp_server.tool()
def update_incident(
    incident_id: str,
    title: Optional[str] = None,
    cause: Optional[str] = None,
    investigation_note: Optional[str] = None,
    status: Optional[str] = None,
    work_item_keys: Optional[List[str]] = None,
    monitoring_log_ids: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    Update an existing incident (e.g. update cause, investigation_note, open status, or linked work items/monitoring logs).
    Args:
        incident_id: Incident key (e.g. 'DAV-INC-1') or numeric ID.
        title: Optional new title.
        cause: Optional updated investigation cause/details.
        investigation_note: Optional updated quick investigation note.
        status: Optional new status ('reported', 'ongoing'). Note: 'done' and 'no longer relevant' are human-only statuses and cannot be set via MCP.
        work_item_keys: Optional list of work item keys to link to this incident.
        monitoring_log_ids: Optional list of monitoring log IDs or keys to link to this incident.
    """
    clean_status = None
    if status is not None:
        clean_status = status.strip().lower().replace("_", " ")
        if clean_status in HUMAN_ONLY_INCIDENT_STATUSES:
            raise ValueError(f"The '{clean_status}' status can only be set by a human via the frontend.")
        if clean_status not in MCP_ALLOWED_INCIDENT_STATUSES:
            raise ValueError(
                f"Invalid incident status '{status}'. Allowed statuses via MCP are: {', '.join(MCP_ALLOWED_INCIDENT_STATUSES)}."
            )
    return get_client().update_incident(
        incident_id=incident_id,
        title=title,
        cause=cause,
        investigation_note=investigation_note,
        status=clean_status,
        work_item_keys=work_item_keys,
        monitoring_log_ids=monitoring_log_ids,
    )

@mcp_server.tool()
def create_monitoring_log(
    description: str,
    agent_id: str,
    project_key: str,
    status: str = "OK",
    incident_id: Optional[str] = None,
    jira_url: str = "",
) -> Dict[str, Any]:
    """
    Create a monitoring log entry to report a check or monitoring run.
    Args:
        description: Full description or log output of the run.
        agent_id: Required agent/model/session identifier in the format '<agent>/<model>/<session-id>' (e.g. 'claude-code/claude-sonnet-4-5/sess-123') filled out by the LLM.
        project_key: Project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
        status: Run status ('OK' or 'Error'). Set by the LLM on creation.
        incident_id: Optional Davai incident ID or key (e.g. 'DAV-INC-1') to link this run to, otherwise null.
        jira_url: Optional URL to a JIRA incident if one is found.
    """
    clean_agent_id = (agent_id or "").strip()
    if not clean_agent_id:
        raise ValueError("The 'agent_id' argument is required when creating a monitoring log via MCP.")
    clean_status = (status or "ok").strip().lower()
    if clean_status not in MCP_ALLOWED_MONITORING_LOG_STATUSES:
        raise ValueError(f"Invalid monitoring log status '{status}'. Allowed statuses are: OK, Error.")
    return get_client().create_monitoring_log(
        description=description,
        agent_id=clean_agent_id,
        project_key=project_key,
        status=clean_status,
        incident_id=incident_id,
        jira_url=jira_url,
    )

@mcp_server.tool()
def get_monitoring_log(log_id: str) -> Dict[str, Any]:
    """
    Retrieve a specific monitoring log by its numeric ID or key (e.g. 'DAV-LOG-1'), including its full run description.
    Args:
        log_id: Monitoring log numeric ID or key (e.g. 'DAV-LOG-1').
    """
    return get_client().get_monitoring_log(log_id=log_id)

@mcp_server.tool()
def list_user_support_tickets(status: Optional[str] = None, project_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List user support tickets (<PROJECT>-SUP-<ID>) in Davai.
    Includes key, title, status, priority, assignees, subtasks list (key and title), and metadata.
    Omits description, context, and progress entries for brevity (use get_user_support_ticket to fetch complete details).
    Args:
        status: Optional status filter ('todo', 'planned', 'in progress', 'blocked', 'review', 'cancelled', 'done').
        project_key: Optional project key filter. Note: There is no default project; provide the project key if known from the user, or ask the user which project to use.
    """
    return get_client().list_user_support_tickets(status=status, project_key=project_key)

@mcp_server.tool()
def get_user_support_ticket(key: str) -> Dict[str, Any]:
    """
    Retrieve details of a specific user support ticket by key (e.g. 'DAV-SUP-1'), including subtasks, context, and progress entries.
    Args:
        key: The user support ticket key (e.g. 'DAV-SUP-1').
    """
    return get_client().get_user_support_ticket(key=key)

@mcp_server.tool()
def create_user_support_ticket(
    title: str,
    project_key: str,
    description: str = "",
    context: Optional[str] = None,
    priority: str = "MEDIUM",
    status: Optional[str] = None,
    active_assignee_username: Optional[str] = None,
    parent_key: Optional[str] = None,
    source: str = "",
    start_date: Optional[str] = None,
    target_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new user support ticket (<PROJECT>-SUP-<ID>) in Davai.
    User support tickets share all fields with work items except they do not use sprints or releases and are isolated in the User Support view.

    Args:
        title: Title of the user support ticket.
        project_key: Target project key. Required — there is no default project. You must provide this from what the user has already told you, or ask the user which project to use before calling this tool.
        description: Original user support request/description.
        context: Optional initial technical context or analysis deduced by the LLM agent (markdown supported).
        priority: Priority level ('LOW', 'MEDIUM', 'HIGH'). Defaults to 'MEDIUM'.
        status: Status ('todo', 'planned', 'in progress', 'blocked', 'review', 'cancelled'). Defaults to 'todo'. Note: 'done' is not permitted via MCP.
        active_assignee_username: Optional username of assigned user. Defaults to the current user (creator) if omitted. Pass empty string to leave unassigned.
        parent_key: Optional parent ticket key for subtasks.
        source: Optional source reference (e.g. requester or external URL).
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

    return get_client().create_user_support_ticket(
        title=title,
        project_key=project_key,
        description=description,
        priority=priority,
        status=status,
        active_assignee_username=active_assignee_username,
        parent_key=parent_key,
        source=source,
        start_date=start_date,
        target_date=target_date,
        context=context,
    )

@mcp_server.tool()
def update_user_support_ticket(
    key: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    active_assignee_username: Optional[str] = None,
    parent_key: Optional[str] = None,
    start_date: Optional[str] = None,
    target_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Update fields of an existing user support ticket (<PROJECT>-SUP-<ID>), including setting or clearing dates.
    Args:
        key: User support ticket key (e.g. 'DAV-SUP-1').
        title: Optional new title.
        description: Optional new description.
        status: Optional new status ('todo', 'planned', 'in progress', 'blocked', 'review', 'cancelled'). Note: 'done' is not permitted via MCP.
        priority: Optional new priority ('LOW', 'MEDIUM', 'HIGH').
        active_assignee_username: Optional username to assign to. Pass empty string to unassign.
        parent_key: Optional parent key to reparent or nest this ticket.
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
    if start_date is not None:
        kwargs["start_date"] = start_date
    if target_date is not None:
        kwargs["target_date"] = target_date
    return get_client().update_user_support_ticket(key=key, **kwargs)

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


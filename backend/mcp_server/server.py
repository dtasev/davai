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

@mcp_server.tool()
def list_work_items(status: Optional[str] = None, project_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List work items in Davai.
    Args:
        status: Optional status filter ('TODO', 'IN_PROGRESS', 'DONE').
        project_key: Optional project key filter (e.g. 'DAV').
    """
    return get_client().list_work_items(status=status, project_key=project_key)

@mcp_server.tool()
def get_work_item(key: str) -> Dict[str, Any]:
    """
    Retrieve details of a specific work item by key (e.g. 'DAV-1').
    Args:
        key: The work item key or ID.
    """
    return get_client().get_work_item(key=key)

@mcp_server.tool()
def create_work_item(
    title: str,
    description: str = "",
    priority: str = "MEDIUM",
    status: str = "TODO",
    project_key: str = "DAV",
    assignee_username: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new work item in Davai.
    Args:
        title: Title/summary of the task.
        description: Detailed task description.
        priority: Priority level ('LOW', 'MEDIUM', 'HIGH'). Defaults to 'MEDIUM'.
        status: Status ('TODO', 'IN_PROGRESS', 'DONE'). Defaults to 'TODO'.
        project_key: Target project key (defaults to 'DAV').
        assignee_username: Optional username of assigned user.
    """
    return get_client().create_work_item(
        title=title,
        description=description,
        priority=priority,
        status=status,
        project_key=project_key,
        assignee_username=assignee_username
    )

@mcp_server.tool()
def update_work_item(
    key: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_username: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update the status, priority, or assignee of an existing work item.
    Args:
        key: Work item key (e.g. 'DAV-1').
        status: Optional new status ('TODO', 'IN_PROGRESS', 'DONE').
        priority: Optional new priority ('LOW', 'MEDIUM', 'HIGH').
        assignee_username: Optional username to assign to. Pass empty string to unassign.
    """
    return get_client().update_work_item(
        key=key,
        status=status,
        priority=priority,
        assignee_username=assignee_username
    )

@mcp_server.tool()
def get_project_summary(project_key: str = "DAV") -> Dict[str, Any]:
    """
    Get a statistical summary of the Davai project board.
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

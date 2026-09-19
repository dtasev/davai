import asyncio
from typing import Optional, List, Dict, Any
from mcp.server.mcpserver import MCPServer
from core.store import list_items, get_item, add_item, update_status

mcp_server = MCPServer(
    name="davai-work-tracker",
    version="0.1.0",
    description="Model Context Protocol interface for Davai Jira-like work management app"
)

@mcp_server.tool()
def list_work_items(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List work items in Davai.
    Args:
        status: Optional status filter ('TODO', 'IN_PROGRESS', 'DONE').
    """
    return list_items(status)

@mcp_server.tool()
def get_work_item(key: str) -> Dict[str, Any]:
    """
    Retrieve details of a specific work item by key (e.g. 'DAV-1').
    Args:
        key: The work item key or ID.
    """
    item = get_item(key)
    if not item:
        raise ValueError(f"Work item with key '{key}' not found.")
    return item

@mcp_server.tool()
def create_work_item(title: str, priority: str = "MEDIUM", assignee: str = "Unassigned") -> Dict[str, Any]:
    """
    Create a new work item in Davai.
    Args:
        title: Title/summary of the task.
        priority: Priority level ('LOW', 'MEDIUM', 'HIGH'). Defaults to 'MEDIUM'.
        assignee: Name of the person or agent assigned. Defaults to 'Unassigned'.
    """
    return add_item(title=title, priority=priority, assignee=assignee)

@mcp_server.tool()
def update_work_item_status(key: str, new_status: str) -> Dict[str, Any]:
    """
    Update the status of a work item.
    Args:
        key: Work item key (e.g. 'DAV-1').
        new_status: New status ('TODO', 'IN_PROGRESS', 'DONE').
    """
    item = update_status(key, new_status)
    if not item:
        raise ValueError(f"Work item with key '{key}' not found.")
    return item

@mcp_server.tool()
def get_project_summary() -> Dict[str, Any]:
    """
    Get a statistical summary of the Davai project board.
    """
    all_items = list_items()
    todo_count = len([i for i in all_items if i["status"] == "TODO"])
    in_progress_count = len([i for i in all_items if i["status"] == "IN_PROGRESS"])
    done_count = len([i for i in all_items if i["status"] == "DONE"])
    total = len(all_items)
    return {
        "project": "DAVAI",
        "total_items": total,
        "todo": todo_count,
        "in_progress": in_progress_count,
        "done": done_count,
        "completion_rate": f"{(done_count / total * 100):.1f}%" if total > 0 else "0.0%"
    }

@mcp_server.resource("davai://board/state")
def get_board_state() -> str:
    """Read the complete real-time JSON state of the Davai work board."""
    import json
    return json.dumps(list_items(), indent=2)

if __name__ == "__main__":
    asyncio.run(mcp_server.run_stdio_async())

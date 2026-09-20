import os
import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional, List, Dict, Any


class DavaiClient:
    """
    Dependency-free HTTP client for the Davai REST API using Python's standard library.
    Can be run anywhere (locally, inside Docker, or remotely) with an API key.
    """
    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = (base_url or os.environ.get("DAVAI_API_URL", "http://127.0.0.1:8000/api")).rstrip("/")
        self.api_key = api_key or os.environ.get("DAVAI_API_KEY")

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Any:
        clean_path = path.lstrip("/")
        url = f"{self.base_url}/{clean_path}"

        if params:
            query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
            if query:
                url = f"{url}?{query}"

        headers = {
            "Accept": "application/json",
            "User-Agent": "Davai-MCP-Client/1.0"
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key

        body = None
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=body, headers=headers, method=method.upper())

        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                content = response.read().decode("utf-8")
                return json.loads(content) if content else {}
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            try:
                err_json = json.loads(error_body)
                msg = err_json.get("detail") or err_json.get("message") or error_body
            except Exception:
                msg = error_body
            raise RuntimeError(f"Davai API error ({e.code}): {msg}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Failed to connect to Davai API at {url}: {e.reason}") from e

    def get_me(self) -> Dict[str, Any]:
        """Fetch authenticated user profile."""
        return self._request("GET", "/auth/me")

    def list_work_items(
        self,
        status: Optional[str] = None,
        project_key: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List work items, optionally filtered by status and project."""
        params = {}
        if status:
            params["status"] = status
        if project_key:
            params["project_key"] = project_key
        return self._request("GET", "/work-items", params=params)

    def get_work_item(self, key: str) -> Dict[str, Any]:
        """Fetch a single work item by its key (e.g. 'DAV-1')."""
        return self._request("GET", f"/work-items/{key}")

    def create_work_item(
        self,
        title: str,
        descr: str = "",
        priority: str = "MEDIUM",
        status: Optional[str] = None,
        project_key: str = "DAV",
        active_assignee_username: Optional[str] = None,
        parent_key: Optional[str] = None,
        source: str = "",
        sprint_id: Optional[int] = None,
        release_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Create a new work item."""
        payload: Dict[str, Any] = {
            "title": title,
            "descr": descr,
            "priority": priority,
            "project_key": project_key,
            "source": source,
        }
        if status:
            payload["status"] = status
        if active_assignee_username:
            payload["active_assignee_username"] = active_assignee_username
        if parent_key:
            payload["parent_key"] = parent_key
        if sprint_id:
            payload["sprint_id"] = sprint_id
        if release_id:
            payload["release_id"] = release_id
        return self._request("POST", "/work-items", data=payload)

    def update_work_item(
        self,
        key: str,
        title: Optional[str] = None,
        descr: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        active_assignee_username: Optional[str] = None,
        parent_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update fields of an existing work item."""
        payload: Dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if descr is not None:
            payload["descr"] = descr
        if status is not None:
            payload["status"] = status
        if priority is not None:
            payload["priority"] = priority
        if active_assignee_username is not None:
            payload["active_assignee_username"] = active_assignee_username
        if parent_key is not None:
            payload["parent_key"] = parent_key
        return self._request("PATCH", f"/work-items/{key}", data=payload)

    def get_work_item_context(self, key: str) -> Dict[str, Any]:
        """Fetch context documentation for a work item."""
        return self._request("GET", f"/work-items/{key}/context")

    def set_work_item_context(self, key: str, t: str) -> Dict[str, Any]:
        """Set or update SKILL.md-style markdown context for a work item."""
        return self._request("PUT", f"/work-items/{key}/context", data={"t": t})

    def list_work_item_progress(self, key: str) -> List[Dict[str, Any]]:
        """List progress entries for a work item."""
        return self._request("GET", f"/work-items/{key}/progress")

    def log_work_item_progress(
        self,
        key: str,
        t: str,
        proof: str = "",
        status: str = "COMPLETED"
    ) -> Dict[str, Any]:
        """Log a progress step with optional git sha, feature branch, or artifact proof."""
        payload = {"t": t, "proof": proof, "status": status}
        return self._request("POST", f"/work-items/{key}/progress", data=payload)

    def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects."""
        return self._request("GET", "/projects")

    def get_project_summary(self, project_key: str = "DAV") -> Dict[str, Any]:
        """Calculate board statistics for a project."""
        items = self.list_work_items(project_key=project_key)
        total = len(items)
        todo_count = len([i for i in items if (i.get("status") or "").lower() == "todo"])
        in_prog_count = len([i for i in items if (i.get("status") or "").lower() in ["in progress", "in_progress"]])
        done_count = len([i for i in items if (i.get("status") or "").lower() == "done"])

        return {
            "project": project_key.upper(),
            "total_items": total,
            "todo": todo_count,
            "in_progress": in_prog_count,
            "done": done_count,
            "completion_rate": f"{(done_count / total * 100):.1f}%" if total > 0 else "0.0%"
        }

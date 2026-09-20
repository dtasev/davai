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
        parent_key: Optional[str] = None,
        sprint_id: Optional[int] = None,
        release_id: Optional[int] = None
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
        if sprint_id is not None:
            payload["sprint_id"] = sprint_id
        if release_id is not None:
            payload["release_id"] = release_id
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

    def list_sprints(self, project_key: str = "DAV") -> List[Dict[str, Any]]:
        """List all sprints for a project."""
        return self._request("GET", f"/projects/{project_key.upper()}/sprints")

    def list_releases(self, project_key: str = "DAV") -> List[Dict[str, Any]]:
        """List all releases for a project."""
        return self._request("GET", f"/projects/{project_key.upper()}/releases")

    def get_project_summary(self, project_key: str = "DAV") -> Dict[str, Any]:
        """Calculate board statistics for a project, including sprint and release breakdowns."""
        items = self.list_work_items(project_key=project_key)
        try:
            sprints = self.list_sprints(project_key=project_key)
        except Exception:
            sprints = []
        try:
            releases = self.list_releases(project_key=project_key)
        except Exception:
            releases = []

        total = len(items)
        todo_count = len([i for i in items if (i.get("status") or "").lower() == "todo"])
        in_prog_count = len([i for i in items if (i.get("status") or "").lower() in ["in progress", "in_progress"]])
        done_count = len([i for i in items if (i.get("status") or "").lower() == "done"])

        sprint_summaries = []
        for s in sprints:
            s_id = s.get("id")
            s_items = [i for i in items if i.get("sprint_id") == s_id]
            s_total = len(s_items)
            s_done = len([i for i in s_items if (i.get("status") or "").lower() == "done"])
            s_in_prog = len([i for i in s_items if (i.get("status") or "").lower() in ["in progress", "in_progress"]])
            s_todo = len([i for i in s_items if (i.get("status") or "").lower() == "todo"])
            sprint_summaries.append({
                "id": s_id,
                "name": s.get("name"),
                "release_id": s.get("release_id"),
                "start_date": s.get("start_date"),
                "end_date": s.get("end_date"),
                "total_items": s_total,
                "todo": s_todo,
                "in_progress": s_in_prog,
                "done": s_done,
                "completion_rate": f"{(s_done / s_total * 100):.1f}%" if s_total > 0 else "0.0%",
            })

        release_summaries = []
        for r in releases:
            r_id = r.get("id")
            r_items = [i for i in items if i.get("release_id") == r_id]
            r_total = len(r_items)
            r_done = len([i for i in r_items if (i.get("status") or "").lower() == "done"])
            r_in_prog = len([i for i in r_items if (i.get("status") or "").lower() in ["in progress", "in_progress"]])
            r_todo = len([i for i in r_items if (i.get("status") or "").lower() == "todo"])
            linked_sprint_names = [s.get("name") for s in sprints if s.get("release_id") == r_id]
            release_summaries.append({
                "id": r_id,
                "name": r.get("name"),
                "start_date": r.get("start_date"),
                "end_date": r.get("end_date"),
                "total_items": r_total,
                "todo": r_todo,
                "in_progress": r_in_prog,
                "done": r_done,
                "completion_rate": f"{(r_done / r_total * 100):.1f}%" if r_total > 0 else "0.0%",
                "linked_sprints": linked_sprint_names,
            })

        unsprinted_items = len([i for i in items if not i.get("sprint_id")])
        unreleased_items = len([i for i in items if not i.get("release_id")])

        return {
            "project": project_key.upper(),
            "total_items": total,
            "todo": todo_count,
            "in_progress": in_prog_count,
            "done": done_count,
            "completion_rate": f"{(done_count / total * 100):.1f}%" if total > 0 else "0.0%",
            "sprints_count": len(sprints),
            "releases_count": len(releases),
            "unsprinted_items": unsprinted_items,
            "unreleased_items": unreleased_items,
            "sprints": sprint_summaries,
            "releases": release_summaries,
        }

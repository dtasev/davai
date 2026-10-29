import logging
from typing import Dict, Any, Optional
from django.db import transaction
from .manager import manager
from .context import get_current_client_id

logger = logging.getLogger(__name__)

def _format_date(dt) -> Optional[str]:
    return dt.isoformat() if dt else None

def notify_on_commit(topic: str, message: Dict[str, Any], origin_client_id: Optional[str] = None):
    """Schedules a WebSocket broadcast immediately after transaction commits."""
    def _broadcast():
        manager.broadcast_sync(topic, message, exclude_client_id=origin_client_id)

    try:
        transaction.on_commit(_broadcast)
    except Exception as e:
        logger.debug("Failed to register on_commit handler: %s", e)
        # If no active transaction, dispatch directly
        _broadcast()

def _tracking_user_ids(related_manager) -> list[int]:
    """Return the user ids tracking an item via its `tracked_by` related manager."""
    try:
        return list(related_manager.values_list("user_id", flat=True))
    except Exception as e:
        logger.debug("Failed to resolve tracking users: %s", e)
        return []

def _emit_tracked_item_update(
    user_ids,
    *,
    item_type: str,
    key: str,
    status: str,
    title: Optional[str] = None,
    project_key: Optional[str] = None,
    origin_client_id: Optional[str] = None,
):
    """Pushes tracked_item.updated to each tracking user's personal topic.

    The tracking drawer lives outside any project view, so it cannot rely on
    `project:<key>` broadcasts; each tracker gets the update on `user:<id>`.
    """
    if not user_ids:
        return
    msg = {
        "event": "tracked_item.updated",
        "item_type": item_type,
        "key": key,
        "status": status,
        "title": title,
        "project_key": project_key,
        "origin_client_id": origin_client_id,
    }
    for user_id in user_ids:
        notify_on_commit(f"user:{user_id}", msg, origin_client_id)

def _tracking_update_for_work_item(item, *, status=None, project_key=None, origin_client_id=None):
    """Best-effort tracked_item.updated fan-out for a WorkItem (or support ticket)."""
    try:
        _emit_tracked_item_update(
            _tracking_user_ids(item.tracked_by),
            item_type="user_support" if getattr(item, "is_support", False) else "work_item",
            key=item.key,
            status=item.status if status is None else status,
            title=item.title,
            project_key=project_key,
            origin_client_id=origin_client_id,
        )
    except Exception as e:
        logger.debug("Failed to emit tracked_item.updated for %s: %s", getattr(item, "key", "?"), e)

def emit_work_item_saved(item, created: bool):
    """Dispatches work_item.created or work_item.updated event."""
    origin_client_id = get_current_client_id()
    project_key = item.project.key if getattr(item, "project", None) else ""
    if not project_key:
        return

    assignee_name = item.active_assignee.username if getattr(item, "active_assignee", None) else None

    if created:
        payload = {
            "id": item.id,
            "key": item.key,
            "is_support": getattr(item, "is_support", False),
            "parent_key": item.parent.key if getattr(item, "parent", None) else None,
            "title": item.title,
            "status": item.status,
            "priority": item.priority,
            "project_key": project_key,
            "active_assignee": assignee_name,
            "sprint_id": item.sprint_id,
            "release_id": item.release_id,
            "start_date": _format_date(item.start_date),
            "target_date": _format_date(item.target_date),
            "created": _format_date(item.created),
            "updated": _format_date(item.updated),
        }
        msg = {
            "event": "work_item.created",
            "project_key": project_key,
            "key": item.key,
            "item": payload,
            "origin_client_id": origin_client_id,
        }
    else:
        changes = {
            "title": item.title,
            "status": item.status,
            "priority": item.priority,
            "active_assignee": assignee_name,
            "sprint_id": item.sprint_id,
            "release_id": item.release_id,
            "start_date": _format_date(item.start_date),
            "target_date": _format_date(item.target_date),
            "updated": _format_date(item.updated),
        }
        msg = {
            "event": "work_item.updated",
            "project_key": project_key,
            "key": item.key,
            "changes": changes,
            "origin_client_id": origin_client_id,
        }

    # Broadcast to project subscribers and item-detail subscribers
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)
    notify_on_commit(f"item:{item.key}", msg, origin_client_id)

    # Trackers may be outside the project view entirely (drawer / dashboard).
    _tracking_update_for_work_item(item, project_key=project_key, origin_client_id=origin_client_id)

def emit_work_item_deleted(project_key: str, key: str):
    origin_client_id = get_current_client_id()
    msg = {
        "event": "work_item.deleted",
        "project_key": project_key,
        "key": key,
        "origin_client_id": origin_client_id,
    }
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)
    notify_on_commit(f"item:{key}", msg, origin_client_id)

def emit_progress_saved(progress, created: bool):
    item = getattr(progress, "work_item", None)
    if not item or not getattr(item, "project", None):
        return

    origin_client_id = get_current_client_id()
    project_key = item.project.key

    payload = {
        "id": progress.id,
        "work_item_key": item.key,
        "summary": progress.summary,
        "proof": progress.proof,
        "status": progress.status,
        "agent_id": progress.agent_id,
        "agent_hostname": progress.agent_hostname,
        "created_at": _format_date(progress.created_at),
        "updated_at": _format_date(progress.updated_at),
    }

    event_type = "progress.created" if created else "progress.updated"
    msg = {
        "event": event_type,
        "project_key": project_key,
        "work_item_key": item.key,
        "progress": payload,
        "origin_client_id": origin_client_id,
    }

    notify_on_commit(f"project:{project_key}", msg, origin_client_id)
    notify_on_commit(f"item:{item.key}", msg, origin_client_id)

    # WorkItem.status is derived from the latest Progress row (`models.py:295`),
    # not from this row alone: `PATCH /work-items/{key}/progress/{id}` can edit an
    # older entry, so `progress.status` is not always the item's status. Within the
    # same transaction `item.status` sees the row just written.
    _tracking_update_for_work_item(
        item,
        status=item.status,
        project_key=project_key,
        origin_client_id=origin_client_id,
    )

def emit_progress_deleted(project_key: str, work_item_key: str, progress_id: int, work_item=None):
    origin_client_id = get_current_client_id()
    msg = {
        "event": "progress.deleted",
        "project_key": project_key,
        "work_item_key": work_item_key,
        "progress_id": progress_id,
        "origin_client_id": origin_client_id,
    }
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)
    notify_on_commit(f"item:{work_item_key}", msg, origin_client_id)

    # Deleting the latest progress row rolls the work item status back to the
    # previous entry, so push the recomputed status to every tracker.
    if work_item is not None:
        try:
            recomputed_status = work_item.status
        except Exception as e:
            logger.debug("Failed to recompute status for %s: %s", work_item_key, e)
            recomputed_status = None
        if recomputed_status is not None:
            _tracking_update_for_work_item(
                work_item,
                status=recomputed_status,
                project_key=project_key,
                origin_client_id=origin_client_id,
            )

def emit_incident_saved(incident, created: bool):
    if not getattr(incident, "project", None):
        return
    origin_client_id = get_current_client_id()
    project_key = incident.project.key

    if created:
        payload = {
            "id": incident.id,
            "key": incident.key,
            "title": incident.title,
            "status": incident.status,
            "cause": incident.cause,
            "created": _format_date(getattr(incident, "created_at", getattr(incident, "created", None))),
            "updated": _format_date(getattr(incident, "updated_at", getattr(incident, "updated", None))),
        }
        msg = {
            "event": "incident.created",
            "project_key": project_key,
            "key": incident.key,
            "incident": payload,
            "origin_client_id": origin_client_id,
        }
    else:
        msg = {
            "event": "incident.updated",
            "project_key": project_key,
            "key": incident.key,
            "changes": {
                "title": incident.title,
                "status": incident.status,
                "cause": incident.cause,
                "investigation_note": incident.investigation_note,
                "updated": _format_date(getattr(incident, "updated_at", getattr(incident, "updated", None))),
            },
            "origin_client_id": origin_client_id,
        }
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)

    try:
        _emit_tracked_item_update(
            _tracking_user_ids(incident.tracked_by),
            item_type="incident",
            key=incident.key,
            status=incident.status,
            title=incident.title,
            project_key=project_key,
            origin_client_id=origin_client_id,
        )
    except Exception as e:
        logger.debug("Failed to emit tracked_item.updated for incident %s: %s", incident.key, e)

def emit_incident_deleted(project_key: str, key: str):
    origin_client_id = get_current_client_id()
    msg = {
        "event": "incident.deleted",
        "project_key": project_key,
        "key": key,
        "origin_client_id": origin_client_id,
    }
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)

def emit_monitoring_log_saved(log, created: bool):
    if not getattr(log, "project", None):
        return
    origin_client_id = get_current_client_id()
    project_key = log.project.key

    if created:
        payload = {
            "id": log.id,
            "key": log.key,
            "description": log.description,
            "status": log.status,
            "agent_id": log.agent_id,
            "incident_id": log.incident.key if log.incident else None,
            "created": _format_date(getattr(log, "created_at", getattr(log, "created", None))),
            "updated": _format_date(getattr(log, "updated_at", getattr(log, "updated", None))),
        }
        msg = {
            "event": "monitoring_log.created",
            "project_key": project_key,
            "key": log.key,
            "monitoring_log": payload,
            "origin_client_id": origin_client_id,
        }
    else:
        msg = {
            "event": "monitoring_log.updated",
            "project_key": project_key,
            "key": log.key,
            "changes": {
                "description": log.description,
                "status": log.status,
                "agent_id": log.agent_id,
                "incident_id": log.incident.key if log.incident else None,
                "updated": _format_date(getattr(log, "updated_at", getattr(log, "updated", None))),
            },
            "origin_client_id": origin_client_id,
        }
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)

def emit_monitoring_log_deleted(project_key: str, key: str):
    origin_client_id = get_current_client_id()
    msg = {
        "event": "monitoring_log.deleted",
        "project_key": project_key,
        "key": key,
        "origin_client_id": origin_client_id,
    }
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)

def emit_sprint_saved(sprint, created: bool):
    if not getattr(sprint, "project", None):
        return
    origin_client_id = get_current_client_id()
    project_key = sprint.project.key

    payload = {
        "id": sprint.id,
        "name": sprint.name,
        "description": sprint.description,
        "status": sprint.status,
        "release_id": sprint.release_id,
        "start_date": _format_date(sprint.start_date),
        "end_date": _format_date(sprint.end_date),
    }
    msg = {
        "event": "sprint.created" if created else "sprint.updated",
        "project_key": project_key,
        "sprint": payload,
        "origin_client_id": origin_client_id,
    }
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)

    try:
        _emit_tracked_item_update(
            _tracking_user_ids(sprint.tracked_by),
            item_type="sprint",
            key=str(sprint.id),
            status=sprint.status or "planned",
            title=sprint.name,
            project_key=project_key,
            origin_client_id=origin_client_id,
        )
    except Exception as e:
        logger.debug("Failed to emit tracked_item.updated for sprint %s: %s", sprint.id, e)

def emit_sprint_deleted(project_key: str, sprint_id: int):
    origin_client_id = get_current_client_id()
    msg = {
        "event": "sprint.deleted",
        "project_key": project_key,
        "sprint_id": sprint_id,
        "origin_client_id": origin_client_id,
    }
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)

def emit_release_saved(release, created: bool):
    if not getattr(release, "project", None):
        return
    origin_client_id = get_current_client_id()
    project_key = release.project.key

    payload = {
        "id": release.id,
        "name": release.name,
        "description": release.description,
        "status": release.status,
        "start_date": _format_date(release.start_date),
        "end_date": _format_date(release.end_date),
    }
    msg = {
        "event": "release.created" if created else "release.updated",
        "project_key": project_key,
        "release": payload,
        "origin_client_id": origin_client_id,
    }
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)

    try:
        _emit_tracked_item_update(
            _tracking_user_ids(release.tracked_by),
            item_type="release",
            key=str(release.id),
            status=release.status or "planned",
            title=release.name,
            project_key=project_key,
            origin_client_id=origin_client_id,
        )
    except Exception as e:
        logger.debug("Failed to emit tracked_item.updated for release %s: %s", release.id, e)

def emit_release_deleted(project_key: str, release_id: int):
    origin_client_id = get_current_client_id()
    msg = {
        "event": "release.deleted",
        "project_key": project_key,
        "release_id": release_id,
        "origin_client_id": origin_client_id,
    }
    notify_on_commit(f"project:{project_key}", msg, origin_client_id)

def _resolve_tracked_item_fields(tracked_item):
    if tracked_item.work_item_id and getattr(tracked_item, "work_item", None):
        item_type = "user_support" if tracked_item.work_item.is_support else "work_item"
        key = tracked_item.work_item.key
        status = tracked_item.work_item.status
    elif tracked_item.incident_id and getattr(tracked_item, "incident", None):
        item_type = "incident"
        key = tracked_item.incident.key
        status = tracked_item.incident.status
    elif tracked_item.sprint_id and getattr(tracked_item, "sprint", None):
        item_type = "sprint"
        key = str(tracked_item.sprint_id)
        status = tracked_item.sprint.status or "planned"
    elif tracked_item.release_id and getattr(tracked_item, "release", None):
        item_type = "release"
        key = str(tracked_item.release_id)
        status = tracked_item.release.status or "planned"
    else:
        item_type = "work_item"
        key = ""
        status = ""
    return item_type, key, status

def emit_tracked_item_saved(tracked_item, created: bool):
    origin_client_id = get_current_client_id()
    item_type, key, status = _resolve_tracked_item_fields(tracked_item)
    msg = {
        "event": "tracked_item.created" if created else "tracked_item.updated",
        "key": key,
        "item_type": item_type,
        "status": status,
        "origin_client_id": origin_client_id,
    }
    notify_on_commit(f"user:{tracked_item.user_id}", msg, origin_client_id)

def emit_tracked_item_deleted(user_id: int, key: str, item_type: str):
    origin_client_id = get_current_client_id()
    msg = {
        "event": "tracked_item.deleted",
        "key": key,
        "item_type": item_type,
        "origin_client_id": origin_client_id,
    }
    notify_on_commit(f"user:{user_id}", msg, origin_client_id)

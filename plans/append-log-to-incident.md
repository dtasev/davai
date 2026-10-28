# Plan: update_incident cleanup + append_log_to_incident tool

Date: 2026-10-28
Status: implemented, reviewed (weft: APPROVE), polished per cross-branch
comparison (plans/append-incident-log-comparison.md): Union[int,str] tool
ids, incident updated_by/updated_at bump on append, schema regression test.
Suite: 71 passed. Pushed to origin/append-incident-log-lfcb-261.

## Goal
1. Remove `monitoring_log_ids` from the MCP `update_incident` tool (tool + client only).
2. Add a new MCP tool `append_log_to_incident` that adds one monitoring log to an
   incident's log list without unlinking existing logs.

## Decisions
- Removal scope: MCP tool + MCP client only. The REST `PATCH /incidents/{id}`
  endpoint, `UpdateIncidentIn`, and `create_incident` keep `monitoring_log_ids`
  (frontend contract unaffected).
- A monitoring log belongs to at most one incident (`MonitoringLog.incident` FK).
  Appending a log that is already linked to a *different* incident → error.
  Appending a log already linked to the *same* incident → idempotent success.

## Changes

### 1. Remove `monitoring_log_ids` from `update_incident` (MCP layer only)
- `backend/mcp_server/server.py` (`update_incident` tool): drop the
  `monitoring_log_ids` parameter + docstring line; reword description to drop
  "monitoring logs".
- `backend/mcp_server/client.py` (`DavaiClient.update_incident`): drop the
  parameter and the `if monitoring_log_ids is not None:` payload branch.

### 2. New REST endpoint (supports the append tool)
- `backend/tracker/api.py`: `POST /incidents/{incident_id}/monitoring-logs/{log_id}`
  (auth `api_key_auth`), placed with the other incident endpoints:
  - Resolve incident via `_get_incident_by_identifier`; resolve log by numeric ID
    or key (e.g. `DAV-LOG-2`) using the same lookup logic as
    `_resolve_linked_monitoring_logs`.
  - 400 if the log's project differs from the incident's project.
  - 400 if the log is already linked to a *different* incident (name that
    incident in the error).
  - Idempotent success if already linked to the same incident.
  - Otherwise set `ml.incident = incident`,
    `save(update_fields=["incident"])`, return updated incident (`IncidentOut`).

### 3. MCP client + tool
- `client.py`: `DavaiClient.append_log_to_incident(incident_id, log_id)` →
  `POST /incidents/{incident_id}/monitoring-logs/{log_id}`.
- `server.py`: `@mcp_server.tool() append_log_to_incident(incident_id: str,
  log_id: str)` placed after `update_incident`. Docstring: appends one
  monitoring log (ID or key) to an incident's log list without unlinking
  existing logs; errors if the log belongs to another incident.

### 4. Tests
- `backend/tracker/tests/test_api.py` — new endpoint: successful append (both
  IDs present afterwards, existing links preserved), same-incident no-op,
  error when linked to another incident, cross-project rejection, unknown log.
- `backend/tracker/tests/test_mcp.py` — import the new tool; after the existing
  monitoring-log flow, create a second unlinked log, `append_log_to_incident`,
  assert both log IDs in `get_incident(...)["monitoring_log_ids"]`; assert
  `update_incident(..., monitoring_log_ids=...)` now raises `TypeError`.

## Verification
```bash
docker compose exec backend pytest tracker/tests/test_mcp.py tracker/tests/test_api.py -k "incident or monitoring"
docker compose exec backend pytest   # full suite
docker compose exec frontend npm run build   # unaffected, but cheap to confirm
```

## Baseline (pre-implementation) test state
- 2026-10-28: stack brought up via host podman (`davai_postgres_1`,
  `davai_backend_1`); migrations applied through 0015.
- `podman exec davai_backend_1 pytest -q` → **69 passed, 10 warnings in 11.38s**
  (green). Warnings are benign: naive-datetime RuntimeWarnings in the MCP test
  and a test-db teardown "being accessed by other users" warning in
  test_safety_guard.py. Backend coverage 84% overall.

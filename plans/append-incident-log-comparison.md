# Comparison report: `append-incident-log` (A) vs `append-incident-log-lfcb-261` (B)

Date: 2026-10-28 · Reviewed by: weft subagent (Qwen3.8-Flash-Next) + orchestrator verification
Commits: A = `225cb39`, B = `32934ff` (both single commits on `master`)

Both branches implement: remove `monitoring_log_ids` from the MCP `update_incident`
tool/client + add MCP tool `append_log_to_incident`.

**Empirical baseline (verified in `davai_backend_1`):** A suite = 69 passed;
B suite = 70 passed; both green.

## Verdict: **B (`append-incident-log-lfcb-261`) is better** — win in 3/4 categories, 1 tie.

| Category | Winner | Why |
|---|---|---|
| Correctness & safety | **B** | B refuses (400) to steal a log linked to another incident and names it; A **silently re-links**, an unrecoverable data change for an LLM agent, undisclosed in its docstring and untested. |
| API design / scope | **B** | B keeps REST `PATCH` contract intact (task was MCP-only); A also strips `monitoring_log_ids` from `UpdateIncidentIn` — silent behavior break for third-party clients (Ninja drops unknown fields → 200 with field ignored; frontend unaffected). |
| Test coverage | **B** | B: dedicated 7-scenario endpoint test (preserve-existing, idempotency, third-log, different-incident + list-unchanged check, cross-project, 404s for id *and* key forms, unknown incident). A: happy path + 2 error cases; misses its own riskiest behavior (silent steal). |
| Style / conventions | tie | A matches the `updated_by` audit convention; B matches route naming and error-message style; both clean. |

## Detailed differences

| Aspect | A `origin/append-incident-log` | B `origin/append-incident-log-lfcb-261` |
|---|---|---|
| Removal scope | MCP **and** REST (`UpdateIncidentIn` + PATCH logic deleted) | MCP tool + client only (approved plan scope) |
| Endpoint | `POST /incidents/{id}/logs` + body `{"log_id": Any}` (new "logs" noun, no other sub-resource uses it) | `POST /incidents/{id}/monitoring-logs/{log_id}` (path param, reuses existing noun) |
| Log already on **another** incident | **Silently steals it** | 400 naming the owner + remediation; asserted in tests |
| Unknown log | 400 (via `_resolve_linked_monitoring_logs`) | 404 (via `_get_monitoring_log_by_identifier`) — consistent with all path-param siblings |
| Audit stamp | bumps `updated_by`/`updated_at` (good) — but also bumps on a whitespace `{"log_id":"  "}` silent no-op 200 (bug) | leaves stamps untouched (minor: MCP readers see stale `updated_at`) |
| MCP param typing | `log_id: Union[int, str]` (better — pydantic 2.13.5 rejects JSON int for `str`-typed params, verified) but `incident_id: str` in the same tool (inconsistent) | `log_id: str` — matches every pre-existing tool, yet rejects a JSON int despite docstring offering "numeric ID" |
| TypeError test | `pytest.raises(TypeError, match="monitoring_log_ids")` (nicer) | bare `pytest.raises(TypeError)` |
| Extras | — | plan document committed (`plans/append-log-to-incident.md`) |

## New findings from the comparative review (undocumented before)
- **A bug:** whitespace `log_id` → `_resolve_linked_monitoring_logs` skips blank idents →
  empty list → handler returns 200 "success" while still bumping `updated_by`/`updated_at`,
  having changed nothing.
- **A inconsistency:** `Union[int, str]` for `log_id` but plain `str` for `incident_id`.
- **B gap:** a JSON-number `log_id` (e.g. `42`) is rejected by FastMCP schema validation —
  friction an LLM will hit; fix cost is one import + one annotation.
- **B gap:** successful append doesn't bump incident audit fields.

## Recommended polish for B (adopt from A)
1. `log_id: Union[int, str]` (and ideally `incident_id`) in the MCP tool signature.
2. `user = request.auth` + `incident.save(update_fields=["updated_by", "updated_at"])`
   after a successful link.
3. `match="monitoring_log_ids"` on the `pytest.raises(TypeError)`.

A, by contrast, would need the safety guard, endpoint rename, and 404 semantics —
a substantive rewrite. Merge **B**.

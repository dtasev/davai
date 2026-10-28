# DAV-83 Active Work Item Tracker (left-side tracked-items drawer)

## TL;DR
Add a per-user "tracked items" feature: a collapsible left drawer in the frontend layout showing manually-tracked Incidents, Work Items, User Support tickets, Sprints, and Releases in five sections, with plus-buttons to toggle tracking in every list/detail view (including sprint/release cards, the All Sprints/All Releases modals, and the sprint/release detail modals), a red trash icon per section that clears only DONE entries, and DONE-at-bottom sorting. Backed by a new `TrackedItem` Django model and Django Ninja endpoints scoped to the authenticated user.

## Context
- Repo: `/workspace/other-k8s/davai`. Django 6 + Django Ninja backend (`backend/`), React 18 + Vite + Tailwind v4 SPA (`frontend/`), Authelia OIDC, PostgreSQL (pgvector). All commands run through docker compose services — **never** run pytest/npm on the host (see `AGENTS.md`).
- Current user in the API is `request.auth` (a Django `User`) resolved by the composite `api_key_auth` authenticator (`backend/tracker/auth.py`, used by every mutating endpoint in `backend/tracker/api.py`). Frontend gets the profile from `GET /api/auth/me` into `AppContext.userProfile` (`frontend/src/context/AppContext.tsx`).
- Domain model facts (`backend/tracker/models.py`):
  - User support tickets are **`WorkItem` rows with `is_support=True`** (keys `DAV-SUP-N`) — there is no separate model.
  - **Sprint and Release are separate models with NO string key** — they are identified by numeric `id` + `name` (not unique). Their API routes (`/projects/{project_key}/sprints/{sprint_id}`, `/projects/{project_key}/releases/{release_id}`) and frontend routes (`/projects/:projectKey/sprints/:sprintId`, `/releases/:releaseId`) all use the numeric id.
  - Sprint/Release completion semantics: `status ∈ planned | in progress | done`, plus a `done_at` timestamp that the model `save()` keeps strictly in sync with `status == "done"`. The existing DONE-at-bottom sorters key off `done_at` (`SprintList.tsx` L22–29, `ReleaseList.tsx` L20–26); for the drawer, `status === "done"` is equivalent and is the signal used.
  - `WorkItem.status` is a **derived property** (latest `Progress.status`, default `"todo"`); `Incident.status` is a plain field with statuses `reported | ongoing | done | no longer relevant`.
- Key frontend files:
  - Layout: `frontend/src/routes/RootLayout.tsx` (Header + centered `max-w-7xl` main; auth-gated).
  - Lists: `frontend/src/components/ProjectDetail/WorkItemList.tsx` (assignee pill in right meta cluster, ~L516), `UserSupportList.tsx` (assignee pill ~L455), `IncidentList.tsx` (right meta pills end with a date pill ~L356 — incidents have no assignee badge, so the plus goes left of the meta cluster).
  - Sprint/Release surfaces: `SprintList.tsx` — active-sprint cards `sprint-card-${id}` with a top-right badge cluster (StatusBadge + release tag, ~L236–244) and `AllSprintsModal` rows `all-sprint-item-${id}` whose right meta cluster ends in a `ChevronRight` (~L107); `ReleaseList.tsx` — release cards `release-card-${id}` with top-right badge cluster (StatusBadge + "Milestone" pill, ~L220–225) and `AllReleasesModal` rows `all-release-item-${id}` (meta cluster ~L77–99).
  - Detail modals: `frontend/src/components/Modals/WorkItemDetailModal.tsx` (shared by work items **and** user support; "Mark work item as Done" `Check` button in `headerActions` ~L536, `data-testid="mark-done-button"`), `IncidentDetailModal.tsx` (`mark-incident-done-button` ~L160), `SprintDetailModal.tsx` (`mark-sprint-done-button` ~L145–159, delete button right after ~L167), `ReleaseDetailModal.tsx` (`mark-release-done-button` ~L147–161, delete ~L169).
  - Shared bits: `Badge.tsx` (`StatusBadge`), `apiFetch.ts` (CSRF + cookies), lucide-react icons (`Plus`, `Menu`, `Trash2`, `ListTodo`, `Flame`, `LifeBuoy`, `Zap`, `Rocket`). Entity accent colours used across the app: emerald=work items, rose=incidents, cyan/indigo=user support, amber=Sprints (`Zap`), indigo=Releases (`Rocket`/`Tag`).
  - Routing for navigation from the drawer: `/projects/:projectKey/items/:itemKey`, `/user-support/:itemKey`, `/incidents/:incidentKey`, `/sprints/:sprintId`, `/releases/:releaseId` (`frontend/src/routes/router.tsx`).
  - Styling conventions: Tailwind utility classes only (dark zinc palette, `rounded-lg/xl`, `border-zinc-800`), `data-testid` on every interactive element.
- Backend test conventions: `backend/conftest.py` fixtures `ninja_client` (Ninja `TestClient`), `test_user`, `test_project`, `test_api_key`; auth in tests via `headers={"X-API-Key": raw_key}`. Next migration number: **0016**.

### Persistence decision (justified)
One model `TrackedItem(user, work_item=null, incident=null, sprint=null, release=null, created_at)`:
- Four concrete nullable FKs beat a `ContentType`/GenericFK because only four target models exist, user support is already a `WorkItem` (no extra FK needed), the codebase never uses `contenttypes`, FKs give integrity + `CASCADE` cleanup when targets are deleted, and section membership is derived from which FK is set (plus `work_item.is_support`) — zero denormalisation to go stale.
- A single polymorphic type+id column would duplicate lookup logic already provided by FKs, cannot express "sprint 3 vs release 3" safely, and loses cascade behaviour.

## Scope
- In scope:
  - `TrackedItem` model + migration 0016 (user FK + four nullable target FKs: WorkItem, Incident, Sprint, Release).
  - Ninja endpoints: list / add (idempotent) / remove one / clear-DONE per section, all scoped to `request.auth`, supporting item types `work_item | user_support | incident | sprint | release`.
  - Frontend: tracked-items context + provider, left collapsible drawer (hamburger when collapsed) with **five sections** (Incidents, Work Items, User Support, Sprints, Releases), status sorting (DONE bottom), red trash clear-DONE per section header, toggle plus-button in: the 3 item lists, the sprint & release cards, the All Sprints / All Releases modals, and the 4 detail modals (work item incl. support, incident, sprint, release).
  - Backend pytest suite + frontend vitest + `npm run build`.
- Out of scope:
  - MCP server tools for tracked items (personal UI feature; `mcp_server/` untouched).
  - GraphQL schema (`tracker/schema.py`) — no tracked-item queries.
  - KanbanBoard and monitoring-log items as trackable targets.
  - Auto-tracking of assigned items (ticket explicitly forbids).
  - Admin registration, drag reordering, notes.
- Constraints / assumptions (confirmed by user unless noted):
  1. CONFIRMED: "DONE-like" = work item derived status `"done"`, incident status `"done"` **or `"no longer relevant"`**, sprint/release status `"done"` (equivalent to `done_at` set, per model `save()` sync). Done-like items sort to the bottom and are the only ones removed by the section trash.
  2. CONFIRMED: the plus button is a **toggle** — when already tracked it renders as an emerald check/X and untracks on click.
  3. CONFIRMED: KanbanBoard, GraphQL, MCP are out of scope.
  4. Sprint/release have no string key, so the add payload identifies them by numeric `id`; item key strings (`DAV-1`, `DAV-SUP-1`, `DAV-INC-1`) remain for the other three types. No upper bound on tracked items; add is idempotent per (user, target).
  5. Drawer open/collapsed state persisted in `localStorage` key `davai_drawer_open`; data itself is server-side per user (no localStorage).
  6. SUPERSEDED by post-execution user review: drawer section order is **Work Items, User Support, Incidents, Sprints, Releases**; expanded width 360px; app-standard font sizes; empty sections show no placeholder.

## Objectives
- O1: Server-persisted, per-user tracked list with typed endpoints and correct auth scoping across all five trackable types (work item, user support, incident, sprint, release).
- O2: Left drawer matching app styling with five independently manageable sections, DONE-at-bottom sort, and section-scoped clear-DONE.
- O3: Track toggles at the exact positions required in every list/card/modal surface, including sprint/release cards, All Sprints/All Releases modals, and the sprint/release detail modals.
- O4: Full test/build coverage through docker compose without breaking existing suites.

## Dependencies and Order
1. Task 1 (model + migration) → everything backend depends on the table existing; all five FKs ship in the one migration (plan is pre-execution — no follow-up migration).
2. Task 2 (API endpoints) → depends on Task 1; frontend contract must exist before UI work is testable.
3. Task 3 (backend tests) → depends on Task 2; run `pytest` before frontend starts.
4. Task 4 (types + context + provider) → depends on Task 2 (endpoint shapes, id-vs-key refs).
5. Task 5 (drawer + RootLayout) → depends on Task 4.
6. Task 6 (TrackButton component + work/support/incident lists & modals integration) → depends on Task 4.
7. Task 7 (sprint/release integration) → depends on Task 6 (reuses the shared `TrackButton`).
8. Task 8 (frontend tests + full verification) → depends on all.

## Tasks

- [x] 1. TrackedItem model + migration
  - **What**: Add the per-user tracking model with four nullable target FKs and DB-level guards.
  - **Files**: `backend/tracker/models.py` (append after `MonitoringLog`), `backend/tracker/migrations/0016_trackeditem.py` (generated).
  - **Depends on**: None.
  - **Implementation outline**:
    1. Define `class TrackedItem(models.Model)` with: `user = FK(User, on_delete=CASCADE, related_name="tracked_items")`, and four nullable FKs — `work_item = FK(WorkItem, null=True, blank=True, on_delete=CASCADE, related_name="tracked_by")`, `incident = FK(Incident, null=True, blank=True, on_delete=CASCADE, related_name="tracked_by")`, `sprint = FK(Sprint, null=True, blank=True, on_delete=CASCADE, related_name="tracked_by")`, `release = FK(Release, null=True, blank=True, on_delete=CASCADE, related_name="tracked_by")` — plus `created_at = DateTimeField(auto_now_add=True)`.
    2. `Meta`: `ordering = ["-created_at", "-id"]`; one partial `UniqueConstraint(fields=["user", <fk>], condition=Q(<fk>__isnull=False), name="unique_user_tracked_<fk>")` per target (four total); one `CheckConstraint` enforcing exactly one of the four FKs is non-null — a 4-way disjunction of `Q(<one>__isnull=False, <other1>__isnull=True, <other2>__isnull=True, <other3>__isnull=True)` terms, named `tracked_item_exactly_one_target`.
    3. `__str__` returning e.g. `f"{self.user.username}: {target_key_or_name}"` (sprint/release use `name`, others `key`).
    4. Generate the migration inside the container: `docker compose exec backend python manage.py makemigrations tracker` (must produce a single 0016 containing all four FKs and all constraints — do not split into follow-up migrations since nothing has executed yet).
  - **Pitfalls / non-goals**:
    - No signal handlers here — the WorkItem/Incident `post_save` embedding signals fire on unrelated saves; do not add tracked items to any embedding logic.
    - Do not use `GenericForeignKey`/`contenttypes` (deliberate decision, see Context).
    - Partial unique constraints with `condition=` are required, otherwise the many `NULL` rows collide.
    - `Sprint`/`Release` rows are project-scoped but ids are globally unique — no project column needed on `TrackedItem`.
  - **Acceptance**:
    - `docker compose exec backend python manage.py makemigrations --check --dry-run` exits 0 after applying `migrate`; migration 0016 contains `work_item`, `incident`, `sprint`, `release` fields, 4 partial unique constraints and the exactly-one check constraint.
    - Two `TrackedItem` rows for different users/targets (incl. one sprint and one release) can be created in `manage.py shell`; a row with two FKs set violates the check constraint.

- [x] 2. Ninja API: schemas + tracked-items endpoints
  - **What**: REST contract for the drawer under `/api/tracked-items`, covering all five item types.
  - **Files**: `backend/tracker/api.py` (append a new section, e.g. after the Monitoring Log endpoints at the end of the file).
  - **Depends on**: Task 1.
  - **Implementation outline**:
    1. Schemas: `TrackedItemOut` (`id: int`, `item_type: str` — resolved as `"user_support"` if `obj.work_item_id and obj.work_item.is_support`, `"work_item"` if `obj.work_item_id`, else `"incident"` / `"sprint"` / `"release"`; `ref_id: int` (target pk); `key: str` — the string identifier used for navigation: work-item/incident `key`, or `str(id)` for sprint/release; `title: str` — work item/incident `title`, sprint/release `name`; `status: str` — `obj.work_item.status`, `obj.incident.status`, `obj.sprint.status or "planned"`, `obj.release.status or "planned"`; `project_key: str`; `added_at: str` isoformat) with `@staticmethod resolve_*` following the file's existing resolver style. `CreateTrackedIn` (`item_type: Literal["work_item","user_support","incident","sprint","release"]`, `key: Optional[str] = None`, `id: Optional[int] = None`).
    2. `GET /tracked-items` (`response=List[TrackedItemOut]`, default project auth): `TrackedItem.objects.filter(user=request.auth).select_related("user", "work_item__project", "incident__project", "sprint__project", "release__project")`.
    3. `POST /tracked-items` (`auth=api_key_auth`, `response=TrackedItemOut`): payload validation — `key` required and `id` ignored for `work_item`/`user_support`/`incident`; `id` required for `sprint`/`release`; missing required ref → `errors.HttpError(400, ...)`. Resolve: `WorkItem.objects.filter(key=key.upper())` for `work_item`/`user_support` (validate `is_support` matches the requested type, else 400); incident key via `_get_incident_by_identifier`; `Sprint.objects.filter(id=payload.id).first()` / `Release.objects.filter(id=payload.id).first()` → 404 when missing. Then `get_or_create` the row for `request.auth` (idempotent — returns existing row, HTTP 200).
    4. `DELETE /tracked-items/done` (`auth=api_key_auth`, query `section: Literal["work_items","user_support","incidents","sprints","releases"]`) — **declare this route BEFORE** `DELETE /tracked-items/{tracked_id}` so the literal path wins. Done-like predicates per section (scoped to `request.auth`): `work_items`/`user_support` → the file's existing `latest_status_subquery` annotation (`Subquery(Progress…order_by("-created_at","-id").values("status")[:1])` + `Coalesce(…, Value("todo"))`) `= "done"` and `is_support` matching the section; `incidents` → `status__in=["done", "no longer relevant"]` (both DONE-like per confirmed decision); `sprints` / `releases` → `status="done"` (kept in sync with `done_at` by the model `save()`). Delete matching `TrackedItem` rows; return `{"success": True, "removed": <count>}`.
    5. `DELETE /tracked-items/{tracked_id}` (`auth=api_key_auth`): `get_object_or_404(TrackedItem, id=tracked_id, user=request.auth)` (ownership enforced by the filter), delete, return `{"success": True, "message": ...}`.
  - **Pitfalls / non-goals**:
    - Route ordering `/done` before `/{tracked_id}` is mandatory or `int` coercion 422s the literal.
    - Do not leak other users' rows: every query must carry `user=request.auth`.
    - The `status` resolvers for work items run a per-row Progress query (N+1). Acceptable at drawer scale — add a comment, do not over-engineer.
    - Do not resolve a sprint by project unless the payload carries one — sprint/release ids are globally unique; cross-project visibility is intentional (the drawer is global, navigation supplies `project_key`).
    - No MCP/human-only status guard needed here (tracking never writes statuses).
  - **Acceptance**:
    - OpenAPI shows the four operations with the 5-value `item_type` and 5-value `section` enums; `GET` with `X-API-Key` returns only the key owner's rows including correct `status`/`project_key` for sprints and releases (`key` = stringified id).
    - Posting the same target twice yields one row; posting a `DAV-SUP-*` key as `work_item` returns 400; sprint/release POST without `id` → 400, with unknown `id` → 404.
    - `docker compose exec backend python manage.py migrate` succeeds.

- [x] 3. Backend test suite for tracked items
  - **What**: pytest coverage of the new endpoints and model constraints, incl. sprints and releases.
  - **Files**: `backend/tracker/tests/test_tracked_items.py` (new).
  - **Depends on**: Task 2.
  - **Implementation outline**:
    1. Use existing fixtures (`ninja_client`, `test_user`, `test_project`, `test_api_key`) and the `X-API-Key` header auth pattern from `test_api.py`. Seed via fixtures/ORM: a regular work item, a support ticket (`is_support=True`), an incident, a `Sprint`, and a `Release`.
    2. Test class `TestTrackedItemsAPI`: 401 unauthenticated list/add/delete; add each of the five types and assert `item_type`, `key`, `title`, `status`, `project_key` in the response (sprint/release: `key == str(sprint.id)`, `title == name`, `status` correct); idempotent re-add (second POST returns same `id`, count unchanged); type/key mismatch (support key posted as `work_item`) → 400; unknown work-item/incident key → 404; sprint/release POST missing `id` → 400 and unknown `id` → 404; user isolation — a second user's key sees an empty list and cannot `DELETE` user A's row (404); `DELETE /{id}` removes only that row.
    3. Clear-DONE tests per section: seed 3 tracked work items with Progress-derived statuses (todo, in progress, done — "done" created directly via ORM like `test_done_status_restricted_from_mcp_and_allowed_for_humans`' human path), `DELETE /tracked-items/done?section=work_items` removes only the done one; support-section isolation both ways; incidents section removes `done` **and** `no longer relevant` but keeps `reported`/`ongoing`; sprints section: `status="done"` sprint row removed, `in progress` kept; releases section: same pattern with `Release`.
    4. Cascade tests: deleting a tracked `WorkItem`, `Incident`, `Sprint`, and `Release` each removes their `TrackedItem` rows.
  - **Pitfalls / non-goals**:
    - The conftest test-DB safety guard requires the standard pytest run — do not add custom DB settings.
    - Creating "done" work items via the API requires a non-MCP User-Agent; easier to create `Progress` rows via ORM. Sprint/Release `done_at` is maintained by model `save()` — just set `status="done"`.
  - **Acceptance**:
    - `docker compose exec backend pytest tracker/tests/test_tracked_items.py` passes with the five-type coverage above; full `docker compose exec backend pytest` stays green.

- [x] 4. Frontend types + tracked-items context/provider
  - **What**: Client state layer for tracked items across all five types.
  - **Files**: `frontend/src/types/index.ts` (append), `frontend/src/context/TrackedItemsContext.tsx` (new), `frontend/src/App.tsx` (wrap provider).
  - **Depends on**: Task 2 (contract), no dependency on the backend running (fetch-tolerant).
  - **Implementation outline**:
    1. In `types/index.ts`: `export type TrackedItemType = 'work_item' | 'user_support' | 'incident' | 'sprint' | 'release'`; `export type TrackedSection = 'work_items' | 'user_support' | 'incidents' | 'sprints' | 'releases'`; `export interface TrackedItem { id: number; item_type: TrackedItemType; ref_id: number; key: string; title: string; status: string; project_key: string; added_at: string }`.
    2. New `TrackedItemsProvider` + `useTrackedItems()` hook: reads `userProfile` via `useApp()`; refetches `GET /api/tracked-items` (via `apiFetch`) whenever `userProfile?.id` changes and on mount; exposes `{ trackedItems, loadingTracked, isTracked(itemType, ident), addTrack(itemType, ident), removeTrack(id), clearDone(section), refreshTracked }` where `ident` is `{ key?: string; id?: number }` — `key` for work_item/user_support/incident, `id` for sprint/release.
    3. `isTracked` comparison rule (shared by all consumers): tracked iff a row exists with `item_type` equal AND (`row.key === ident.key` for key-ref types, OR `row.ref_id === ident.id` for sprint/release). `addTrack` POSTs `{ item_type, key?/id? }` then refetches (or optimistically appends the response row); `removeTrack`/`clearDone(section)` mutate then refetch; all handlers swallow network errors like `AppContext` does (`try/catch`, no unhandled rejections). `clearDone(section)` calls `DELETE /api/tracked-items/done?section=${section}`.
    4. In `App.tsx`: nest `<TrackedItemsProvider>` inside `<AppProvider>` around `<RouterProvider>`.
  - **Pitfalls / non-goals**:
    - Existing tests mock `globalThis.fetch` with URL-specific branches; unmocked URLs return `undefined`. Every fetch here must guard (`if (res && res.ok)`) so `App.test.tsx` keeps passing without touching its mocks.
    - No localStorage persistence of items; no polling — refresh after own mutations and on auth change only.
    - `userProfile === null` → skip fetching (login screen).
    - Do not invent client-side string keys for sprints/releases — the identity contract is `ref_id`.
  - **Acceptance**:
    - `npm run build` typechecks; context usable from any component under the router; logout (userProfile → null) clears the in-memory list; `isTracked` works for a `{ id: 7, item_type: 'sprint' }`-style call.

- [x] 5. TrackingDrawer component + RootLayout mount
  - **What**: The left collapsible drawer with five sections and clear-DONE trashes.
  - **Files**: `frontend/src/components/Drawer/TrackingDrawer.tsx` (new), `frontend/src/routes/RootLayout.tsx` (modify), `frontend/src/components/Drawer/` (new dir).
  - **Depends on**: Task 4.
  - **Implementation outline**:
    1. Collapsed state: fixed-height `w-11` strip with a `Menu` (lucide) hamburger button (`data-testid="drawer-toggle"`); expanded: `w-64` panel (`data-testid="tracking-drawer"`) with header "Tracking" + `PanelLeftClose` collapse button. Persist to `localStorage['davai_drawer_open']`; CSS `transition-all` on width to match app transition styling.
    2. Sections rendered by a small internal `Section` component in this order: **Incidents** (rose `Flame`), **Work Items** (emerald `ListTodo`), **User Support** (cyan `LifeBuoy`), **Sprints** (amber `Zap`), **Releases** (indigo `Rocket`) — header styling mirrors the lists' icon tiles (`w-7 h-7 rounded-lg bg-<accent>/10 border border-<accent>/20`), count in `font-mono text-zinc-500`, and a right-aligned red `Trash2` button (`text-rose-400 hover:text-rose-300 hover:bg-rose-500/10`, `data-testid="drawer-clear-done-<section>"`, `title="Clear done items"`, disabled/hidden when the section has no done-like entries) calling `clearDone(section)`.
    3. Done-like predicate for sort + trash enablement: `(status)` lowercased is `'done'`, plus `'no longer relevant'` for incidents (mirrors backend Task 2 — keep both definitions in one exported helper, e.g. `isDoneLike(item)` inside the drawer module or in `types`). Comparator replicates the sprint/release sorter shape (`SprintList.tsx` L22–29): non-done-like first keeping `added_at`-desc, done-like at the bottom.
    4. Row: for work/support/incident — mono accent `key` + `StatusBadge` + truncated `title`; for sprint/release — entity icon (`Zap`/`Rocket`) + `title` (name) + `StatusBadge` (their `key` is a bare number, don't render it as a mono key). Hover `bg-zinc-800/40`, `data-testid={`drawer-item-${item.item_type}-${item.key}`}`; click navigates via `useNavigate()`: `/projects/${project_key}/items|user-support/${key}`, `/incidents/${key}`, `/sprints/${ref_id}`, `/releases/${ref_id}`; a `X`/untrack mini-button (`data-testid={`drawer-remove-${item.id}`}`) calls `removeTrack(id)`.
    5. RootLayout: after the auth gate, wrap the page body in `<div className="flex flex-1 min-w-0">` — `<TrackingDrawer />` first, then the existing `<main className="flex-1 min-w-0 ...">` (keep `max-w-7xl mx-auto` inner content). Drawer is inside the authenticated layout only, never rendered on the `loadingAuth` / login screens.
  - **Pitfalls / non-goals**:
    - Do not disturb the centered `max-w-7xl` main layout when collapsed (strip is `shrink-0`).
    - Detail modals are router-driven — navigation from the drawer works because they are child routes; no modal-state hacks.
    - Do not add mobile-overlay/backdrop logic; simple flex strip at all breakpoints.
    - Empty section shows a muted "Nothing tracked yet." placeholder (`border-dashed border-zinc-800` style used elsewhere).
    - The main `SprintList`/`ReleaseList` inline views only render non-done cards — done sprints/releases can therefore only become tracked-then-done via the All-modal/detail views or status changes; the drawer must still sort them to the bottom, never hide them.
  - **Acceptance**:
    - Toggle persists across reloads; five sections render in the order Incidents, Work Items, User Support, Sprints, Releases; trash per section removes only done-like rows (incl. `no longer relevant` incidents); done-like rows sit at the bottom of each section; clicking a sprint/release row routes to `/projects/<pk>/sprints/<id>` / `/releases/<id>` and opens its modal.

- [x] 6. TrackButton component + integration into item lists and item detail modals
  - **What**: Shared toggle button wired into the 3 item lists and the work-item/support/incident detail modals.
  - **Files**: `frontend/src/components/Common/TrackButton.tsx` (new); `frontend/src/components/ProjectDetail/WorkItemList.tsx`; `frontend/src/components/ProjectDetail/UserSupportList.tsx`; `frontend/src/components/ProjectDetail/IncidentList.tsx`; `frontend/src/components/Modals/WorkItemDetailModal.tsx`; `frontend/src/components/Modals/IncidentDetailModal.tsx`.
  - **Depends on**: Task 4. Independent of Task 5 (parallelisable, same-context consumer).
  - **Implementation outline**:
    1. `TrackButton({ itemType, ident, size = 'sm' })` where `ident: { key?: string; item id?: number }` (props: `itemKey?: string; itemId?: number`): consumes `useTrackedItems()`; untracked → `Plus` icon button (`p-1 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800`), tracked → `Check` icon (`text-emerald-400`); `title`/`aria-label` "Track in sidebar" / "Remove from tracking"; `e.stopPropagation()` on click so row navigation doesn't fire; `data-testid={`track-${itemType}-${itemKey ?? itemId}`}`.
    2. `WorkItemList.tsx`: insert as the **last child before the `active_assignee` pill** inside the right meta cluster (~L516), `itemType={item.is_support ? 'user_support' : 'work_item'}` — "on the right side, left of the assignee badge".
    3. `UserSupportList.tsx`: same position relative to the assignee pill (~L455), `itemType="user_support"`.
    4. `IncidentList.tsx`: insert at the **start of the right meta pills cluster** (~L335, before the linked-work-items pill), `itemType="incident"` (incidents have no assignee badge).
    5. `WorkItemDetailModal.tsx` `headerActions`: insert immediately **before** the `mark-done-button` block (~L536), `itemType={isSupport ? 'user_support' : 'work_item'}`.
    6. `IncidentDetailModal.tsx` `headerActions`: insert immediately **before** the `mark-incident-done-button` block (~L159), `itemType="incident"`.
  - **Pitfalls / non-goals**:
    - Row click handlers wrap the whole row — the button must `stopPropagation` or tracking also opens the modal.
    - KanbanBoard and MonitoringLogList are explicit non-goals — do not touch them.
    - `tsc` build fails on unused imports (`TS6133`) — remove any icon imports you swap out.
  - **Acceptance**:
    - On `/projects/DAV` each work item / support / incident row shows the toggle left of the assignee badge / at the start of the meta pills; toggling in a list is immediately reflected in the drawer and detail modal (shared context).
    - Both detail modals show the toggle left of the mark-done `Check` button; existing mark-done/delete/copy buttons unchanged in order.

- [x] 7. TrackButton integration into sprint & release surfaces
  - **What**: Track toggles on sprint/release cards, the All Sprints / All Releases modals, and both detail modals.
  - **Files**: `frontend/src/components/ProjectDetail/SprintList.tsx` (card + `AllSprintsModal`), `frontend/src/components/ProjectDetail/ReleaseList.tsx` (card + `AllReleasesModal`), `frontend/src/components/Modals/SprintDetailModal.tsx`, `frontend/src/components/Modals/ReleaseDetailModal.tsx`.
  - **Depends on**: Task 6 (reuses `TrackButton`); Task 4 for the contract.
  - **Implementation outline**:
    1. `SprintList.tsx` active-sprint card (`sprint-card-${s.id}`, ~L221): insert `<TrackButton itemType="sprint" itemId={s.id} />` as the **first element of the top-right badge cluster** (the `flex items-center gap-1.5 shrink-0` div holding `StatusBadge` + release tag, ~L236–244) — mirrors "plus left of the status/assignee badge".
    2. `AllSprintsModal` row (`all-sprint-item-${s.id}`): insert at the **end of the right meta cluster, immediately before the `ChevronRight`** (~L107).
    3. `ReleaseList.tsx` release card (`release-card-${r.id}`, ~L207): TrackButton as first element of the top-right badge cluster (~L220, left of `StatusBadge`/"Milestone" pill); `AllReleasesModal` row (`all-release-item-${r.id}`): before its `ChevronRight` (~L99). `itemType="release"`, `itemId={r.id}`.
    4. `SprintDetailModal.tsx` `headerActions`: insert immediately **left of `mark-sprint-done-button`** (~L145), inside the `{onUpdate && …}` group or just before it so the button also renders in read-only mode (pass it unconditionally before the group). `ReleaseDetailModal.tsx`: same, left of `mark-release-done-button` (~L147).
    5. All inserts must `stopPropagation` (already handled inside `TrackButton`) because cards and All-modal rows navigate on row click.
  - **Pitfalls / non-goals**:
    - Sprint/release have no string key — use `itemId={s.id}` / `itemId={r.id}`; `isTracked` matches on `ref_id` (Task 4 rule).
    - `AllSprintsModal`/`AllReleasesModal` are exported from the same files as the lists — one edit pass per file, both components covered.
    - No changes to sprint/release creation, status editing, or sorting in these files — UI insertion only.
    - `tsc -b` unused-import failures if an existing icon import becomes unused.
  - **Acceptance**:
    - `/projects/DAV` default view: sprint and release cards show the toggle left of the status badge; the All Sprints / All Releases modals show it per row; toggling from any of the four positions syncs the drawer and the other views (shared context).
    - Sprint/release detail modals show the toggle immediately left of the mark-done button, before delete; clicking it never triggers the card/row navigation.

- [x] 8. Frontend tests + full verification
  - **What**: Vitest coverage and the complete gate.
  - **Files**: `frontend/src/components/Drawer/TrackingDrawer.test.tsx` (new), optionally extend `frontend/src/App.test.tsx` fetch mock with `/api/tracked-items` branches.
  - **Depends on**: Tasks 5, 6, 7.
  - **Implementation outline**:
    1. In the drawer test, render `App` with a `createMemoryRouter` (pattern from `App.test.tsx`), mock `globalThis.fetch` including `/api/tracked-items` GET/POST/DELETE with an in-memory array; seed a mix of done/non-done work items, incidents (incl. one `no longer relevant`), support tickets, sprints and releases.
    2. Assert: drawer renders after auth and toggle exists (`drawer-toggle`); all five sections render in order with counts; done-like rows appear after non-done within each section; clicking `drawer-clear-done-work_items` DELETEs with `?section=work_items` and only done entries disappear; same for `drawer-clear-done-sprints` (done sprint row disappears, in-progress sprint stays); list/card rows expose `track-work_item-DAV-1`, `track-sprint-1`, `track-release-1` style buttons and clicking one POSTs the right payload (`{item_type:'sprint', id:1}`) and the drawer gains the row.
    3. Extend existing project-detail test flow (or add cases) so the sprint card and release card toggles are found by testid on the default project view.
    4. Run everything in containers: `docker compose exec backend pytest`; `docker compose exec frontend npm test -- --run`; `docker compose exec frontend npm run build`.
  - **Pitfalls / non-goals**:
    - The App-level test mock is URL-branch based — unhandled URLs return `undefined`; the tracked-items mock must intercept all methods (GET/POST/DELETE) or provider code paths must tolerate undefined responses (Task 4 guard).
    - Do not add snapshot tests; follow the behavioural `data-testid` querying style.
  - **Acceptance**:
    - `docker compose exec backend pytest` — all green incl. new tracked-items tests (five types).
    - `docker compose exec frontend npm test -- --run` — all green incl. drawer tests covering sprint/release sections and toggles.
    - `docker compose exec frontend npm run build` — succeeds (tsc + vite) with no TS6133.

## Verification
1. `docker compose exec backend python manage.py migrate` then `docker compose exec backend python manage.py makemigrations --check --dry-run` → "No changes detected".
2. `docker compose exec backend pytest` → existing suites + `test_tracked_items.py` all pass (coverage table prints, no failures).
3. `docker compose exec frontend npm test -- --run` → all suites pass including `TrackingDrawer.test.tsx`.
4. `docker compose exec frontend npm run build` → clean `tsc -b && vite build`.
5. Manual smoke at `http://127.0.0.1:6477`: log in via Authelia; collapse/expand the drawer; plus-button adds a work item from the list AND its detail modal; a sprint and a release are tracked from their cards, from the All Sprints/All Releases modals, and from their detail modals (state syncs everywhere); trash in a section header removes only Done entries (and `no longer relevant` incidents); done rows sit at the bottom; tracked sprint/release rows navigate to their modals; a second browser user sees an empty drawer.

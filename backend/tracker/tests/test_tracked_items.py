"""
Permanent test coverage for the per-user tracked-items feature (DAV-83):

- /api/tracked-items endpoints (GET list, POST add, DELETE /done?section=…, DELETE /{id})
- TrackedItem model constraints (exactly-one-target, per-user uniqueness)
- CASCADE removal of tracked rows when their target object is deleted
"""
from datetime import datetime

import pytest
from django.db import IntegrityError, transaction
from django.contrib.auth.models import User

from tracker.auth import generate_api_key
from tracker.models import Incident, Progress, Release, Sprint, TrackedItem, WorkItem


# ---------------------------------------------------------------------------
# Local fixtures / helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def headers(test_api_key):
    """X-API-Key headers for test_user."""
    _, raw_key = test_api_key
    return {"X-API-Key": raw_key}


@pytest.fixture
def other_user(db):
    """A second, distinct user for isolation tests."""
    return User.objects.create_user(username="otheruser", email="otheruser@example.com")


@pytest.fixture
def other_headers(other_user):
    _, raw_key = generate_api_key(other_user, name="Other Pytest Key")
    return {"X-API-Key": raw_key}


def make_work_item(project, user, title, status=None, is_support=False):
    """Create a work item; optionally seed its status via a Progress row."""
    item = WorkItem.objects.create(
        project=project, title=title, created_by=user, is_support=is_support
    )
    if status:
        Progress.objects.create(
            work_item=item, summary=f"status -> {status}", status=status, created_by=user
        )
    return item


def make_incident(project, user, title, status="reported"):
    return Incident.objects.create(project=project, title=title, status=status, created_by=user)


def tracked_id_map(user):
    """Map target description -> tracked row id for a user, via the API-adjacent ORM."""
    rows = {}
    for row in TrackedItem.objects.filter(user=user):
        if row.work_item_id:
            rows[row.work_item.key] = row.id
        elif row.incident_id:
            rows[row.incident.key] = row.id
        elif row.sprint_id:
            rows[f"sprint:{row.sprint_id}"] = row.id
        else:
            rows[f"release:{row.release_id}"] = row.id
    return rows


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestTrackedItemsAPI:
    # -- Authentication -----------------------------------------------------

    def test_list_unauthenticated_returns_401(self, ninja_client):
        assert ninja_client.get("/tracked-items").status_code == 401

    def test_add_unauthenticated_returns_401(self, ninja_client):
        res = ninja_client.post("/tracked-items", json={"item_type": "work_item", "key": "DAV-1"})
        assert res.status_code == 401

    def test_delete_unauthenticated_returns_401(self, ninja_client):
        assert ninja_client.delete("/tracked-items/1").status_code == 401

    def test_clear_done_unauthenticated_returns_401(self, ninja_client):
        assert ninja_client.delete("/tracked-items/done?section=work_items").status_code == 401

    # -- Add each of the five types ------------------------------------------

    def test_add_work_item(self, ninja_client, headers, test_user, test_project):
        item = make_work_item(test_project, test_user, "Tracked regular item")  # no Progress -> todo
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "work_item", "key": item.key}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["item_type"] == "work_item"
        assert data["ref_id"] == item.id
        assert data["key"] == item.key
        assert data["title"] == "Tracked regular item"
        assert data["status"] == "todo"
        assert data["project_key"] == "DAV"
        assert datetime.fromisoformat(data["added_at"])  # valid ISO-8601 string

        listing = ninja_client.get("/tracked-items", headers=headers)
        assert listing.status_code == 200
        assert [row["key"] for row in listing.json()] == [item.key]

    def test_add_user_support_ticket(self, ninja_client, headers, test_user, test_project):
        ticket = make_work_item(
            test_project, test_user, "Tracked support ticket", is_support=True
        )
        assert "-SUP-" in ticket.key
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "user_support", "key": ticket.key}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["item_type"] == "user_support"
        assert data["ref_id"] == ticket.id
        assert data["key"] == ticket.key
        assert data["title"] == "Tracked support ticket"
        assert data["status"] == "todo"
        assert data["project_key"] == "DAV"

    def test_add_incident(self, ninja_client, headers, test_user, test_project):
        incident = make_incident(test_project, test_user, "Tracked outage")
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "incident", "key": incident.key}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["item_type"] == "incident"
        assert data["ref_id"] == incident.id
        assert data["key"] == incident.key
        assert data["title"] == "Tracked outage"
        assert data["status"] == "reported"
        assert data["project_key"] == "DAV"

    def test_add_sprint(self, ninja_client, headers, test_project):
        sprint = Sprint.objects.create(project=test_project, name="Sprint Alpha", status="in progress")
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "sprint", "id": sprint.id}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["item_type"] == "sprint"
        assert data["ref_id"] == sprint.id
        assert data["key"] == str(sprint.id)
        assert data["title"] == "Sprint Alpha"
        assert data["status"] == "in progress"
        assert data["project_key"] == "DAV"

    def test_add_release(self, ninja_client, headers, test_project):
        release = Release.objects.create(project=test_project, name="v1.2", status="planned")
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "release", "id": release.id}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["item_type"] == "release"
        assert data["ref_id"] == release.id
        assert data["key"] == str(release.id)
        assert data["title"] == "v1.2"
        assert data["status"] == "planned"
        assert data["project_key"] == "DAV"

    def test_add_sprint_defaults_to_planned_when_status_empty(self, ninja_client, headers, test_project):
        sprint = Sprint.objects.create(project=test_project, name="No status sprint")
        Sprint.objects.filter(id=sprint.id).update(status="")
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "sprint", "id": sprint.id}
        )
        assert res.status_code == 200
        assert res.json()["status"] == "planned"

    # -- Idempotency ----------------------------------------------------------

    def test_re_adding_same_work_item_is_idempotent(self, ninja_client, headers, test_user, test_project):
        item = make_work_item(test_project, test_user, "Idempotent target")
        first = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "work_item", "key": item.key}
        )
        second = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "work_item", "key": item.key}
        )
        assert first.status_code == 200 and second.status_code == 200
        assert first.json()["id"] == second.json()["id"]
        assert TrackedItem.objects.count() == 1

    def test_re_adding_same_sprint_is_idempotent(self, ninja_client, headers, test_project):
        sprint = Sprint.objects.create(project=test_project, name="Sprint Idempotent")
        first = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "sprint", "id": sprint.id}
        )
        second = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "sprint", "id": sprint.id}
        )
        assert first.json()["id"] == second.json()["id"]
        assert TrackedItem.objects.count() == 1

    # -- Validation / error paths ---------------------------------------------

    def test_support_ticket_posted_as_work_item_returns_400(
        self, ninja_client, headers, test_user, test_project
    ):
        ticket = make_work_item(test_project, test_user, "Support mistyped", is_support=True)
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "work_item", "key": ticket.key}
        )
        assert res.status_code == 400
        assert "user support ticket" in res.json()["detail"]
        assert TrackedItem.objects.count() == 0

    def test_regular_work_item_posted_as_user_support_returns_400(
        self, ninja_client, headers, test_user, test_project
    ):
        item = make_work_item(test_project, test_user, "Regular mistyped")
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "user_support", "key": item.key}
        )
        assert res.status_code == 400
        assert "work item" in res.json()["detail"]
        assert TrackedItem.objects.count() == 0

    def test_unknown_work_item_key_returns_404(self, ninja_client, headers):
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "work_item", "key": "DAV-99999"}
        )
        assert res.status_code == 404
        assert "DAV-99999" in res.json()["detail"]

    def test_unknown_incident_key_returns_404(self, ninja_client, headers):
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "incident", "key": "DAV-INC-4242"}
        )
        assert res.status_code == 404
        assert "DAV-INC-4242" in res.json()["detail"]

    def test_missing_key_for_work_item_returns_400(self, ninja_client, headers):
        res = ninja_client.post("/tracked-items", headers=headers, json={"item_type": "work_item"})
        assert res.status_code == 400

    def test_missing_key_for_incident_returns_400(self, ninja_client, headers):
        res = ninja_client.post("/tracked-items", headers=headers, json={"item_type": "incident"})
        assert res.status_code == 400
        assert "key" in res.json()["detail"]

    def test_sprint_without_id_returns_400(self, ninja_client, headers):
        res = ninja_client.post("/tracked-items", headers=headers, json={"item_type": "sprint"})
        assert res.status_code == 400
        assert "id" in res.json()["detail"]

    def test_release_without_id_returns_400(self, ninja_client, headers):
        res = ninja_client.post("/tracked-items", headers=headers, json={"item_type": "release"})
        assert res.status_code == 400
        assert "id" in res.json()["detail"]

    def test_sprint_unknown_id_returns_404(self, ninja_client, headers):
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "sprint", "id": 987654}
        )
        assert res.status_code == 404
        assert "987654" in res.json()["detail"]

    def test_release_unknown_id_returns_404(self, ninja_client, headers):
        res = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "release", "id": 987654}
        )
        assert res.status_code == 404
        assert "987654" in res.json()["detail"]

    # -- User isolation and single-row delete ----------------------------------

    def test_user_isolation_on_list_and_delete(
        self, ninja_client, headers, other_headers, test_user, test_project
    ):
        item = make_work_item(test_project, test_user, "A's item")
        incident = make_incident(test_project, test_user, "A's incident")
        sprint = Sprint.objects.create(project=test_project, name="A's sprint")
        for payload in (
            {"item_type": "work_item", "key": item.key},
            {"item_type": "incident", "key": incident.key},
            {"item_type": "sprint", "id": sprint.id},
        ):
            assert ninja_client.post("/tracked-items", headers=headers, json=payload).status_code == 200
        a_row_ids = {row["id"] for row in ninja_client.get("/tracked-items", headers=headers).json()}
        assert len(a_row_ids) == 3

        # Second user sees an empty list
        other_list = ninja_client.get("/tracked-items", headers=other_headers)
        assert other_list.status_code == 200
        assert other_list.json() == []

        # Second user cannot delete the first user's rows
        victim_id = sorted(a_row_ids)[0]
        forbidden = ninja_client.delete(f"/tracked-items/{victim_id}", headers=other_headers)
        assert forbidden.status_code == 404
        assert TrackedItem.objects.count() == 3

        # Second user tracking the same work item gets their own separate row
        own = ninja_client.post(
            "/tracked-items", headers=other_headers, json={"item_type": "work_item", "key": item.key}
        )
        assert own.status_code == 200
        assert own.json()["id"] not in a_row_ids
        assert TrackedItem.objects.count() == 4

    def test_delete_removes_only_the_targeted_row(
        self, ninja_client, headers, test_user, test_project
    ):
        item_a = make_work_item(test_project, test_user, "Keep me")
        item_b = make_work_item(test_project, test_user, "Remove me")
        res_a = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "work_item", "key": item_a.key}
        )
        res_b = ninja_client.post(
            "/tracked-items", headers=headers, json={"item_type": "work_item", "key": item_b.key}
        )
        doomed_id = res_b.json()["id"]

        dele = ninja_client.delete(f"/tracked-items/{doomed_id}", headers=headers)
        assert dele.status_code == 200
        assert dele.json()["success"] is True

        remaining = ninja_client.get("/tracked-items", headers=headers).json()
        assert [row["key"] for row in remaining] == [item_a.key]
        assert res_a.json()["id"] == remaining[0]["id"]

        # Deleting again now 404s
        assert ninja_client.delete(f"/tracked-items/{doomed_id}", headers=headers).status_code == 404

    # -- Clear-DONE per section --------------------------------------------------

    def test_clear_done_work_items_removes_only_done_work_items(
        self, ninja_client, headers, test_user, test_project
    ):
        wi_todo = make_work_item(test_project, test_user, "WI todo")  # no Progress -> todo
        wi_active = make_work_item(test_project, test_user, "WI active", status="in progress")
        wi_done = make_work_item(test_project, test_user, "WI done", status="in progress")
        # A later Progress row flips the status to done: exercises latest-entry ordering
        Progress.objects.create(work_item=wi_done, summary="closed", status="done", created_by=test_user)
        sup_done = make_work_item(
            test_project, test_user, "SUP done", status="done", is_support=True
        )
        for item in (wi_todo, wi_active, wi_done, sup_done):
            item_type = "user_support" if item.is_support else "work_item"
            assert ninja_client.post(
                "/tracked-items", headers=headers, json={"item_type": item_type, "key": item.key}
            ).status_code == 200

        res = ninja_client.delete("/tracked-items/done?section=work_items", headers=headers)
        assert res.status_code == 200
        assert res.json() == {"success": True, "removed": 1}

        ids = tracked_id_map(test_user)
        assert set(ids) == {wi_todo.key, wi_active.key, sup_done.key}
        assert wi_done.key not in ids

    def test_clear_done_user_support_section_is_only_affected_for_support(
        self, ninja_client, headers, test_user, test_project
    ):
        wi_done = make_work_item(test_project, test_user, "WI done", status="done")
        sup_done = make_work_item(test_project, test_user, "SUP done", status="done", is_support=True)
        sup_todo = make_work_item(test_project, test_user, "SUP todo", is_support=True)
        for item in (wi_done, sup_done, sup_todo):
            item_type = "user_support" if item.is_support else "work_item"
            ninja_client.post(
                "/tracked-items", headers=headers, json={"item_type": item_type, "key": item.key}
            )

        res = ninja_client.delete("/tracked-items/done?section=user_support", headers=headers)
        assert res.status_code == 200
        assert res.json()["removed"] == 1
        ids = tracked_id_map(test_user)
        assert set(ids) == {wi_done.key, sup_todo.key}

        # And the work_items section then only removes the (non-support) done item
        res2 = ninja_client.delete("/tracked-items/done?section=work_items", headers=headers)
        assert res2.json()["removed"] == 1
        assert set(tracked_id_map(test_user)) == {sup_todo.key}

    def test_clear_done_defaults_to_work_items_section(
        self, ninja_client, headers, test_user, test_project
    ):
        wi_done = make_work_item(test_project, test_user, "WI done", status="done")
        sup_done = make_work_item(test_project, test_user, "SUP done", status="done", is_support=True)
        ninja_client.post("/tracked-items", headers=headers, json={"item_type": "work_item", "key": wi_done.key})
        ninja_client.post("/tracked-items", headers=headers, json={"item_type": "user_support", "key": sup_done.key})

        res = ninja_client.delete("/tracked-items/done", headers=headers)
        assert res.status_code == 200
        assert res.json()["removed"] == 1
        assert set(tracked_id_map(test_user)) == {sup_done.key}

    def test_clear_done_incidents_removes_done_and_no_longer_relevant(
        self, ninja_client, headers, test_user, test_project
    ):
        statuses = {
            "reported": "reported",
            "ongoing": "ongoing",
            "resolved": "done",
            "stale": "no longer relevant",
        }
        incidents = {
            label: make_incident(test_project, test_user, f"Incident {label}", status=status)
            for label, status in statuses.items()
        }
        for incident in incidents.values():
            ninja_client.post(
                "/tracked-items", headers=headers, json={"item_type": "incident", "key": incident.key}
            )

        res = ninja_client.delete("/tracked-items/done?section=incidents", headers=headers)
        assert res.status_code == 200
        assert res.json()["removed"] == 2
        ids = tracked_id_map(test_user)
        assert set(ids) == {incidents["reported"].key, incidents["ongoing"].key}

    def test_clear_done_sprints_removes_only_done_sprints(self, ninja_client, headers, test_project):
        active = Sprint.objects.create(project=test_project, name="Active sprint", status="in progress")
        done = Sprint.objects.create(project=test_project, name="Done sprint", status="done")
        tracked_ids = []
        for sprint in (active, done):
            res = ninja_client.post(
                "/tracked-items", headers=headers, json={"item_type": "sprint", "id": sprint.id}
            )
            tracked_ids.append(res.json()["id"])

        res = ninja_client.delete("/tracked-items/done?section=sprints", headers=headers)
        assert res.status_code == 200
        assert res.json()["removed"] == 1
        remaining = list(TrackedItem.objects.values_list("id", flat=True))
        assert remaining == [tracked_ids[0]]  # active sprint row survives

    def test_clear_done_releases_removes_only_done_releases(self, ninja_client, headers, test_project):
        planned = Release.objects.create(project=test_project, name="v2.0", status="planned")
        done = Release.objects.create(project=test_project, name="v1.0", status="done")
        tracked_ids = []
        for release in (planned, done):
            res = ninja_client.post(
                "/tracked-items", headers=headers, json={"item_type": "release", "id": release.id}
            )
            tracked_ids.append(res.json()["id"])

        res = ninja_client.delete("/tracked-items/done?section=releases", headers=headers)
        assert res.status_code == 200
        assert res.json()["removed"] == 1
        remaining = list(TrackedItem.objects.values_list("id", flat=True))
        assert remaining == [tracked_ids[0]]  # planned release row survives

    def test_clear_done_is_scoped_to_requesting_user(
        self, ninja_client, headers, other_headers, test_user, test_project
    ):
        mine = make_work_item(test_project, test_user, "A done item", status="done")
        theirs = make_work_item(test_project, test_user, "B done item", status="done")
        ninja_client.post("/tracked-items", headers=headers, json={"item_type": "work_item", "key": mine.key})
        ninja_client.post("/tracked-items", headers=other_headers, json={"item_type": "work_item", "key": theirs.key})

        res = ninja_client.delete("/tracked-items/done?section=work_items", headers=headers)
        assert res.json()["removed"] == 1
        assert TrackedItem.objects.filter(user=test_user).count() == 0
        # The other user's identical-status tracked row is untouched
        assert TrackedItem.objects.exclude(user=test_user).count() == 1


# ---------------------------------------------------------------------------
# Model constraint tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestTrackedItemModel:
    def test_exactly_one_target_constraint_rejects_two_targets(self, test_user, test_project):
        item = make_work_item(test_project, test_user, "Two targets item")
        sprint = Sprint.objects.create(project=test_project, name="Two targets sprint")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                TrackedItem.objects.create(user=test_user, work_item=item, sprint=sprint)

    def test_exactly_one_target_constraint_rejects_no_target(self, test_user):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                TrackedItem.objects.create(user=test_user)

    def test_per_user_uniqueness_per_target(self, test_user, other_user, test_project):
        item = make_work_item(test_project, test_user, "Unique constraint item")
        TrackedItem.objects.create(user=test_user, work_item=item)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                TrackedItem.objects.create(user=test_user, work_item=item)
        # A different user may track the same target
        other_row = TrackedItem.objects.create(user=other_user, work_item=item)
        assert TrackedItem.objects.count() == 2
        assert other_row.__str__() == f"{other_user.username}: {item.key}"


# ---------------------------------------------------------------------------
# CASCADE deletion tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestTrackedItemCascade:
    def test_deleting_tracked_work_item_removes_tracked_row(self, test_user, test_project):
        item = make_work_item(test_project, test_user, "Cascade WI")
        TrackedItem.objects.create(user=test_user, work_item=item)
        assert TrackedItem.objects.count() == 1
        item.delete()
        assert TrackedItem.objects.count() == 0

    def test_deleting_tracked_incident_removes_tracked_row(self, test_user, test_project):
        incident = make_incident(test_project, test_user, "Cascade incident")
        TrackedItem.objects.create(user=test_user, incident=incident)
        assert TrackedItem.objects.count() == 1
        incident.delete()
        assert TrackedItem.objects.count() == 0

    def test_deleting_tracked_sprint_removes_tracked_row(self, test_user, test_project):
        sprint = Sprint.objects.create(project=test_project, name="Cascade sprint")
        TrackedItem.objects.create(user=test_user, sprint=sprint)
        assert TrackedItem.objects.count() == 1
        sprint.delete()
        assert TrackedItem.objects.count() == 0

    def test_deleting_tracked_release_removes_tracked_row(self, test_user, test_project):
        release = Release.objects.create(project=test_project, name="Cascade release")
        TrackedItem.objects.create(user=test_user, release=release)
        assert TrackedItem.objects.count() == 1
        release.delete()
        assert TrackedItem.objects.count() == 0

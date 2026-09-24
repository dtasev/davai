import pytest
from django.utils import timezone
from tracker.models import (
    Project,
    ProjectStatus,
    Release,
    Sprint,
    WorkItem,
    Context,
    Progress,
    APIKey
)

@pytest.mark.django_db
class TestDomainModels:
    def test_project_default_status_seeding(self):
        project = Project.objects.create(key="ALPHA", name="Alpha System", description="Alpha project")
        statuses = list(project.statuses.all())
        assert len(statuses) == 7
        status_names = [s.name for s in statuses]
        assert status_names == ["todo", "planned", "in progress", "blocked", "review", "done", "cancelled"]

        default_status = project.get_default_status()
        assert default_status is not None
        assert default_status.name == "todo"
        assert default_status.is_default is True

    def test_work_item_creation_defaults_to_project_status(self, test_project, test_user):
        item = WorkItem.objects.create(
            project=test_project,
            key="DAV-200",
            title="Auto Status Item",
            description="Human-readable description",
            created_by=test_user
        )
        assert item.status is not None
        assert item.status == "todo"
        assert item.description == "Human-readable description"
        assert str(item) == "DAV-200: Auto Status Item [todo]"

    def test_work_item_subtasks(self, test_project, test_user):
        parent = WorkItem.objects.create(
            project=test_project,
            key="DAV-10",
            title="Parent Feature",
            created_by=test_user
        )
        child1 = WorkItem.objects.create(
            project=test_project,
            key="DAV-11",
            title="Child 1",
            parent=parent,
            created_by=test_user
        )
        child2 = WorkItem.objects.create(
            project=test_project,
            key="DAV-12",
            title="Child 2",
            parent=parent,
            created_by=test_user
        )

        subtasks = list(parent.subtasks.all())
        assert len(subtasks) == 2
        assert child1 in subtasks
        assert child2 in subtasks
        assert child1.parent == parent

    def test_sprint_and_release_association(self, test_project, test_user):
        release = Release.objects.create(
            project=test_project,
            name="v1.0",
            description="Production release"
        )
        sprint = Sprint.objects.create(
            project=test_project,
            release=release,
            name="Sprint 1",
            description="Sprint 1 description"
        )
        item = WorkItem.objects.create(
            project=test_project,
            key="DAV-50",
            title="Planned Item",
            created_by=test_user,
            release=release,
            sprint=sprint
        )
        assert item.release == release
        assert item.sprint == sprint
        assert item in release.work_items.all()
        assert item in sprint.work_items.all()
        assert sprint in release.sprints.all()

    def test_context_llm_guidelines(self, test_project, test_user):
        item = WorkItem.objects.create(
            project=test_project,
            key="DAV-60",
            title="Context Item",
            created_by=test_user
        )
        ctx = Context.objects.create(
            work_item=item,
            user=test_user,
            summary="## Implementation Rules\n1. Strictly ORM\n2. Follow patterns"
        )
        assert item.context == ctx
        assert str(ctx) == f"Context for {item.key}"
        assert "Strictly ORM" in item.context.summary

    def test_progress_with_proof_and_status(self, test_project, test_user):
        item = WorkItem.objects.create(
            project=test_project,
            key="DAV-70",
            title="Progress Item",
            created_by=test_user
        )
        p1 = Progress.objects.create(
            work_item=item,
            created_by=test_user,
            summary="Drafted data models",
            proof="git:feature-models-branch",
            status="in progress"
        )
        assert item.status == "in progress"

        p2 = Progress.objects.create(
            work_item=item,
            created_by=test_user,
            summary="Encountered blocker on migrations",
            proof="https://github.com/org/repo/issues/9",
            status="blocked"
        )

        entries = list(item.progress.all())
        assert len(entries) == 2
        assert entries[0] == p1
        assert entries[1] == p2
        assert entries[0].created_by == test_user
        assert entries[0].proof == "git:feature-models-branch"
        assert entries[1].status == "blocked"
        assert item.status == "blocked"
        assert str(p1).startswith(f"Progress for {item.key}")

    def test_sequential_work_item_key_generation(self, test_user):
        proj = Project.objects.create(key="SEQ", name="Sequential Project")
        assert proj.last_work_item_number == 0

        # Create items via generate_next_work_item_key / auto-key in save
        item1 = WorkItem.objects.create(project=proj, title="Task 1", created_by=test_user)
        assert item1.key == "SEQ-1"
        assert proj.last_work_item_number == 1

        item2 = WorkItem.objects.create(project=proj, title="Task 2", created_by=test_user)
        assert item2.key == "SEQ-2"
        assert proj.last_work_item_number == 2

        # Manually create SEQ-3
        WorkItem.objects.create(project=proj, key="SEQ-3", title="Task 3 Manual", created_by=test_user)

        # Next auto key skips SEQ-3 to avoid collision
        item4 = WorkItem.objects.create(project=proj, title="Task 4", created_by=test_user)
        assert item4.key == "SEQ-4"

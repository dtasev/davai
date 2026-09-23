from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from pgvector.django import VectorField, HnswIndex


class APIKey(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=100, default="Default Key", help_text="Label for this API key")
    prefix = models.CharField(max_length=16, db_index=True, help_text="Display prefix (e.g. dav_live_a1b2)")
    key_hash = models.CharField(max_length=64, unique=True, db_index=True, help_text="SHA-256 hash of secret key")
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "API Key"
        verbose_name_plural = "API Keys"

    def __str__(self):
        return f"{self.name} ({self.prefix}...) - {self.user.username}"


class Project(models.Model):
    key = models.CharField(max_length=10, unique=True, db_index=True, help_text="Project prefix key (e.g. DAV)")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return f"[{self.key}] {self.name}"

    def get_default_status(self):
        status = self.statuses.filter(is_default=True).first()
        if not status:
            status = self.statuses.filter(name__iexact="todo").first()
        if not status:
            status = self.statuses.first()
        return status


class ProjectStatus(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="statuses")
    name = models.CharField(max_length=50)
    order = models.PositiveIntegerField(default=0)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "id"]
        unique_together = ("project", "name")

    def __str__(self):
        return f"{self.project.key}: {self.name}"


STANDARD_STATUSES = (
    "todo",
    "planned",
    "step completed",
    "blocked",
    "awaiting review",
    "done",
    "cancelled",
)

ALL_PROGRESS_STATUSES = STANDARD_STATUSES + ("failed",)

DEFAULT_PROJECT_STATUSES = [
    (name, name == "todo", order)
    for order, name in enumerate(STANDARD_STATUSES)
]


@receiver(post_save, sender=Project)
def create_default_project_statuses(sender, instance, created, **kwargs):
    if created:
        for name, is_default, order in DEFAULT_PROJECT_STATUSES:
            ProjectStatus.objects.get_or_create(
                project=instance,
                name=name,
                defaults={"is_default": is_default, "order": order}
            )


class Release(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="releases")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]

    def __str__(self):
        return f"{self.project.key} Release: {self.name}"


class Sprint(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="sprints")
    release = models.ForeignKey(Release, null=True, blank=True, on_delete=models.SET_NULL, related_name="sprints")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]

    def __str__(self):
        return f"{self.project.key} Sprint: {self.name}"


class WorkItem(models.Model):
    PRIORITY_CHOICES = [
        ("LOW", "Low"),
        ("MEDIUM", "Medium"),
        ("HIGH", "High"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="work_items")
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name="subtasks")
    key = models.CharField(max_length=30, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_work_items")
    updated = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="updated_work_items")
    active_assignee = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="active_assigned_work_items")
    assigned = models.ManyToManyField(User, blank=True, related_name="assigned_work_items")
    watching = models.ManyToManyField(User, blank=True, related_name="watching_work_items")
    source = models.TextField(blank=True, help_text="Link or description of the source of this work item")
    start_date = models.DateTimeField(null=True, blank=True)
    target_date = models.DateTimeField(null=True, blank=True)
    sprint = models.ForeignKey(Sprint, null=True, blank=True, on_delete=models.SET_NULL, related_name="work_items")
    release = models.ForeignKey(Release, null=True, blank=True, on_delete=models.SET_NULL, related_name="work_items")
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="MEDIUM")

    class Meta:
        ordering = ["id"]

    @property
    def status(self) -> str:
        if hasattr(self, "_prefetched_objects_cache") and "progress" in self._prefetched_objects_cache:
            entries = self.progress.all()
            if entries:
                return entries[len(entries) - 1].status
            return "todo"
        latest = self.progress.order_by("-created_at", "-id").first()
        return latest.status if latest else "todo"

    def __str__(self):
        return f"{self.key}: {self.title} [{self.status}]"


class Context(models.Model):
    work_item = models.OneToOneField(WorkItem, on_delete=models.CASCADE, related_name="context")
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="contexts")
    timestamp = models.DateTimeField(auto_now=True)
    summary = models.TextField(help_text="SKILL.md-style markdown context for LLM agent and developer")

    def __str__(self):
        return f"Context for {self.work_item.key}"


class Progress(models.Model):
    STATUS_CHOICES = [(s, s.title()) for s in ALL_PROGRESS_STATUSES]

    work_item = models.ForeignKey(WorkItem, on_delete=models.CASCADE, related_name="progress")
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_progress_entries")
    summary = models.TextField(help_text="Progress log, completed step, decision, or blocker note")
    proof = models.CharField(
        max_length=500,
        blank=True,
        help_text="If the work is version controlled, this should be a feature branch or a git sha; if not, then a link to the destination or artifact."
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="step completed")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    updated_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="updated_progress_entries")

    class Meta:
        ordering = ["created_at"]
        verbose_name_plural = "Progress"

    def __str__(self):
        return f"Progress for {self.work_item.key} at {self.created_at.isoformat()}"


class WorkItemEmbedding(models.Model):
    work_item = models.OneToOneField(WorkItem, on_delete=models.CASCADE, related_name="embedding")
    embedding = VectorField(dimensions=384)
    content_hash = models.CharField(max_length=64, db_index=True)
    embedded_text = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            HnswIndex(
                name="work_item_vec_hnsw_idx",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            )
        ]

    def __str__(self):
        return f"Embedding for {self.work_item.key}"


@receiver(post_save, sender=WorkItem)
def handle_work_item_saved(sender, instance, created, **kwargs):
    try:
        from tracker.embedding import schedule_work_item_indexing
        schedule_work_item_indexing(instance.id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to schedule auto-indexing for work item %s: %s", instance.key, e)


@receiver([post_save, post_delete], sender=Context)
def handle_context_changed(sender, instance, **kwargs):
    try:
        if getattr(instance, "work_item_id", None):
            from tracker.embedding import schedule_work_item_indexing
            schedule_work_item_indexing(instance.work_item_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to schedule re-indexing on context change: %s", e)


@receiver([post_save, post_delete], sender=Progress)
def handle_progress_changed(sender, instance, **kwargs):
    try:
        if getattr(instance, "work_item_id", None):
            from tracker.embedding import schedule_work_item_indexing
            schedule_work_item_indexing(instance.work_item_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to schedule re-indexing on progress change: %s", e)


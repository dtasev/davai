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
    last_work_item_number = models.PositiveIntegerField(
        default=0,
        help_text="Counter for sequential work item keys within this project",
    )
    last_incident_number = models.PositiveIntegerField(
        default=0,
        help_text="Counter for sequential incident keys within this project",
    )
    last_monitoring_log_number = models.PositiveIntegerField(
        default=0,
        help_text="Counter for sequential monitoring log keys within this project",
    )
    last_user_support_number = models.PositiveIntegerField(
        default=0,
        help_text="Counter for sequential user support keys within this project",
    )

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

    def generate_next_work_item_key(self) -> str:
        """
        Atomically generates and reserves the next sequential work item key for this project.
        """
        from django.db import transaction
        with transaction.atomic():
            proj = Project.objects.select_for_update().get(pk=self.pk)
            while True:
                proj.last_work_item_number += 1
                candidate_key = f"{proj.key}-{proj.last_work_item_number}"
                if not self.work_items.filter(key=candidate_key).exists():
                    break
            proj.save(update_fields=["last_work_item_number"])
            self.last_work_item_number = proj.last_work_item_number
            return candidate_key

    def generate_next_user_support_key(self) -> str:
        """
        Atomically generates and reserves the next sequential user support key for this project (e.g. DAV-SUP-1).
        """
        from django.db import transaction
        with transaction.atomic():
            proj = Project.objects.select_for_update().get(pk=self.pk)
            while True:
                proj.last_user_support_number += 1
                candidate_key = f"{proj.key}-SUP-{proj.last_user_support_number}"
                if not self.work_items.filter(key=candidate_key).exists():
                    break
            proj.save(update_fields=["last_user_support_number"])
            self.last_user_support_number = proj.last_user_support_number
            return candidate_key

    def generate_next_incident_key(self) -> str:
        """
        Atomically generates and reserves the next sequential incident key for this project (e.g. DAV-INC-1).
        """
        from django.db import transaction
        with transaction.atomic():
            proj = Project.objects.select_for_update().get(pk=self.pk)
            while True:
                proj.last_incident_number += 1
                candidate_key = f"{proj.key}-INC-{proj.last_incident_number}"
                if not self.incidents.filter(key=candidate_key).exists():
                    break
            proj.save(update_fields=["last_incident_number"])
            self.last_incident_number = proj.last_incident_number
            return candidate_key

    def generate_next_monitoring_log_key(self) -> str:
        """
        Atomically generates and reserves the next sequential monitoring log key for this project (e.g. DAV-LOG-1).
        """
        from django.db import transaction
        with transaction.atomic():
            proj = Project.objects.select_for_update().get(pk=self.pk)
            while True:
                proj.last_monitoring_log_number += 1
                candidate_key = f"{proj.key}-LOG-{proj.last_monitoring_log_number}"
                if not self.monitoring_logs.filter(key=candidate_key).exists():
                    break
            proj.save(update_fields=["last_monitoring_log_number"])
            self.last_monitoring_log_number = proj.last_monitoring_log_number
            return candidate_key


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
    "in progress",
    "blocked",
    "review",
    "done",
    "cancelled",
)

ALL_PROGRESS_STATUSES = STANDARD_STATUSES

INCIDENT_STATUSES = (
    "reported",
    "ongoing",
    "done",
    "no longer relevant",
)

HUMAN_ONLY_INCIDENT_STATUSES = (
    "done",
    "no longer relevant",
)

MONITORING_LOG_STATUSES = (
    "ok",
    "error",
)

SPRINT_RELEASE_STATUSES = (
    "planned",
    "in progress",
    "done",
)

HUMAN_ONLY_SPRINT_RELEASE_STATUSES = (
    "done",
)

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
    STATUS_CHOICES = [(s, s.title()) for s in SPRINT_RELEASE_STATUSES]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="releases")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="planned")
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    done_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]

    def save(self, *args, **kwargs):
        if self.status == "done":
            if not self.done_at:
                self.done_at = timezone.now()
        else:
            self.done_at = None
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.project.key} Release: {self.name}"


class Sprint(models.Model):
    STATUS_CHOICES = [(s, s.title()) for s in SPRINT_RELEASE_STATUSES]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="sprints")
    release = models.ForeignKey(Release, null=True, blank=True, on_delete=models.SET_NULL, related_name="sprints")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="planned")
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    done_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]

    def save(self, *args, **kwargs):
        if self.status == "done":
            if not self.done_at:
                self.done_at = timezone.now()
        else:
            self.done_at = None
        super().save(*args, **kwargs)

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
    key = models.CharField(max_length=40, unique=True, db_index=True)
    is_support = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True if this item is a User Support ticket (<PROJECT>-SUP-<ID>)",
    )
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

    def save(self, *args, **kwargs):
        if self.key and "-SUP-" in self.key.upper():
            self.is_support = True
        if not self.key and self.project_id:
            if self.is_support:
                self.key = self.project.generate_next_user_support_key()
            else:
                self.key = self.project.generate_next_work_item_key()
        if self.is_support:
            self.sprint = None
            self.release = None
        super().save(*args, **kwargs)

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
    agent_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Agent/model/session identification (e.g. <agent>/<model>/<session-id>) filled out by the LLM"
    )
    summary = models.TextField(help_text="Progress log, completed step, decision, or blocker note")
    proof = models.CharField(
        max_length=500,
        blank=True,
        help_text="If the work is version controlled, this should be a feature branch or a git sha; if not, then a link to the destination or artifact."
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="in progress")
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


class Incident(models.Model):
    STATUS_CHOICES = [(s, s.title()) for s in INCIDENT_STATUSES]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="incidents")
    key = models.CharField(max_length=40, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    cause = models.TextField(blank=True, help_text="Investigation cause and details of the incident")
    investigation_note = models.TextField(
        blank=True,
        help_text="Quick investigation note (specific things to check to confirm/deny recurrence)"
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="reported")
    work_items = models.ManyToManyField(WorkItem, blank=True, related_name="incidents")
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_incidents"
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="updated_incidents"
    )

    class Meta:
        ordering = ["-created_at", "-id"]

    def save(self, *args, **kwargs):
        if not self.key and self.project_id:
            self.key = self.project.generate_next_incident_key()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.key}: {self.title} [{self.status}]"


class IncidentEmbedding(models.Model):
    incident = models.OneToOneField(Incident, on_delete=models.CASCADE, related_name="embedding")
    embedding = VectorField(dimensions=384)
    content_hash = models.CharField(max_length=64, db_index=True)
    embedded_text = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            HnswIndex(
                name="incident_vec_hnsw_idx",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            )
        ]

    def __str__(self):
        return f"Embedding for {self.incident.key}"


class MonitoringLog(models.Model):
    STATUS_CHOICES = [
        ("ok", "OK"),
        ("error", "Error"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="monitoring_logs")
    key = models.CharField(max_length=40, unique=True, db_index=True)
    agent_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Agent/model/session identification (e.g. <agent>/<model>/<session-id>) filled out by the LLM"
    )
    description = models.TextField(help_text="Description/log of the monitoring run")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ok")
    incident = models.ForeignKey(
        Incident, null=True, blank=True, on_delete=models.SET_NULL, related_name="monitoring_logs"
    )
    jira_url = models.CharField(
        max_length=500,
        blank=True,
        help_text="Link to a JIRA incident if one is found"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_monitoring_logs"
    )

    class Meta:
        ordering = ["-created_at", "-id"]

    def save(self, *args, **kwargs):
        if not self.key and self.project_id:
            self.key = self.project.generate_next_monitoring_log_key()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.key} [{self.status.upper()}] ({self.created_at.isoformat()})"


@receiver(post_save, sender=WorkItem)
def handle_work_item_saved(sender, instance, created, **kwargs):
    try:
        from tracker.embedding import schedule_work_item_indexing
        schedule_work_item_indexing(instance.id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to schedule auto-indexing for work item %s: %s", instance.key, e)


@receiver(post_save, sender=Incident)
def handle_incident_saved(sender, instance, created, **kwargs):
    try:
        from tracker.embedding import schedule_incident_indexing
        schedule_incident_indexing(instance.id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to schedule auto-indexing for incident %s: %s", instance.key, e)


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



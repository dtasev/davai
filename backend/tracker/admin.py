from django.contrib import admin
from tracker.models import (
    APIKey,
    Project,
    ProjectStatus,
    Release,
    Sprint,
    WorkItem,
    Context,
    Progress,
    WorkItemEmbedding,
    Incident,
    IncidentEmbedding,
    MonitoringLog,
)


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "prefix", "is_active", "created_at", "last_used_at")
    list_filter = ("is_active", "created_at")
    search_fields = ("name", "user__username", "prefix")
    readonly_fields = ("prefix", "key_hash", "created_at", "last_used_at")


class ProjectStatusInline(admin.TabularInline):
    model = ProjectStatus
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "key",
        "name",
        "last_work_item_number",
        "last_user_support_number",
        "last_incident_number",
        "last_monitoring_log_number",
        "created_at",
    )
    readonly_fields = (
        "last_work_item_number",
        "last_user_support_number",
        "last_incident_number",
        "last_monitoring_log_number",
    )
    search_fields = ("key", "name")
    inlines = [ProjectStatusInline]


@admin.register(ProjectStatus)
class ProjectStatusAdmin(admin.ModelAdmin):
    list_display = ("project", "name", "order", "is_default")
    list_filter = ("project", "is_default")
    search_fields = ("name", "project__key", "project__name")


@admin.register(Release)
class ReleaseAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "status", "start_date", "end_date", "done_at", "created_at")
    list_filter = ("project", "status")
    search_fields = ("name", "description", "project__key")


@admin.register(Sprint)
class SprintAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "release", "status", "start_date", "end_date", "done_at", "created_at")
    list_filter = ("project", "release", "status")
    search_fields = ("name", "description", "project__key")


class ContextInline(admin.StackedInline):
    model = Context
    extra = 0


class ProgressInline(admin.TabularInline):
    model = Progress
    extra = 0


@admin.register(WorkItem)
class WorkItemAdmin(admin.ModelAdmin):
    list_display = ("key", "title", "project", "is_support", "status", "priority", "active_assignee", "updated")
    list_filter = ("is_support", "priority", "project", "sprint", "release")
    search_fields = ("key", "title", "description", "active_assignee__username")
    inlines = [ContextInline, ProgressInline]


@admin.register(Context)
class ContextAdmin(admin.ModelAdmin):
    list_display = ("work_item", "user", "timestamp")
    search_fields = ("work_item__key", "summary")


@admin.register(Progress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ("work_item", "created_by", "agent_id", "status", "proof", "created_at", "updated_at")
    list_filter = ("status", "created_at", "updated_at")
    search_fields = ("work_item__key", "agent_id", "summary", "proof")


@admin.register(WorkItemEmbedding)
class WorkItemEmbeddingAdmin(admin.ModelAdmin):
    list_display = ("work_item", "content_hash", "updated_at")
    search_fields = ("work_item__key", "content_hash", "embedded_text")
    readonly_fields = ("content_hash", "embedded_text", "updated_at")


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ("key", "title", "project", "status", "created_by", "created_at", "updated_at")
    list_filter = ("status", "project")
    search_fields = ("key", "title", "cause", "investigation_note")


@admin.register(IncidentEmbedding)
class IncidentEmbeddingAdmin(admin.ModelAdmin):
    list_display = ("incident", "content_hash", "updated_at")
    search_fields = ("incident__key", "content_hash", "embedded_text")
    readonly_fields = ("content_hash", "embedded_text", "updated_at")


@admin.register(MonitoringLog)
class MonitoringLogAdmin(admin.ModelAdmin):
    list_display = ("key", "project", "status", "agent_id", "incident", "jira_url", "created_at")
    list_filter = ("status", "project")
    search_fields = ("key", "agent_id", "description", "jira_url", "incident__key")


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
    list_display = ("key", "name", "created_at")
    search_fields = ("key", "name")
    inlines = [ProjectStatusInline]


@admin.register(ProjectStatus)
class ProjectStatusAdmin(admin.ModelAdmin):
    list_display = ("project", "name", "order", "is_default")
    list_filter = ("project", "is_default")
    search_fields = ("name", "project__key", "project__name")


@admin.register(Release)
class ReleaseAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "start_date", "end_date", "created_at")
    list_filter = ("project",)
    search_fields = ("name", "description", "project__key")


@admin.register(Sprint)
class SprintAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "release", "start_date", "end_date", "created_at")
    list_filter = ("project", "release")
    search_fields = ("name", "description", "project__key")


class ContextInline(admin.StackedInline):
    model = Context
    extra = 0


class ProgressInline(admin.TabularInline):
    model = Progress
    extra = 0


@admin.register(WorkItem)
class WorkItemAdmin(admin.ModelAdmin):
    list_display = ("key", "title", "project", "status", "priority", "active_assignee", "updated")
    list_filter = ("status", "priority", "project", "sprint", "release")
    search_fields = ("key", "title", "description", "active_assignee__username")
    inlines = [ContextInline, ProgressInline]


@admin.register(Context)
class ContextAdmin(admin.ModelAdmin):
    list_display = ("work_item", "user", "timestamp")
    search_fields = ("work_item__key", "summary")


@admin.register(Progress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ("work_item", "created_by", "status", "proof", "created_at", "updated_at")
    list_filter = ("status", "created_at", "updated_at")
    search_fields = ("work_item__key", "summary", "proof")

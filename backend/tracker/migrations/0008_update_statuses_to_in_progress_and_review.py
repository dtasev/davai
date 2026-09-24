from django.db import migrations, models


def forwards_update_statuses(apps, schema_editor):
    Progress = apps.get_model('tracker', 'Progress')
    Project = apps.get_model('tracker', 'Project')
    ProjectStatus = apps.get_model('tracker', 'ProjectStatus')

    # 1. Update Progress records
    Progress.objects.filter(status__iexact='step completed').update(status='in progress')
    Progress.objects.filter(status__iexact='awaiting review').update(status='review')
    Progress.objects.filter(status__iexact='failed').update(status='blocked')

    # 2. Update ProjectStatus records
    STANDARD_STATUSES = [
        ("todo", True, 0),
        ("planned", False, 1),
        ("in progress", False, 2),
        ("blocked", False, 3),
        ("review", False, 4),
        ("done", False, 5),
        ("cancelled", False, 6),
    ]

    rename_map = {
        "step completed": "in progress",
        "awaiting review": "review",
        "failed": "blocked",
    }

    for project in Project.objects.all():
        existing_statuses = list(ProjectStatus.objects.filter(project=project))
        by_name = {s.name.lower(): s for s in existing_statuses}

        # Rename legacy statuses if target doesn't already exist
        for old_name, new_name in rename_map.items():
            if old_name in by_name:
                if new_name not in by_name:
                    status_obj = by_name[old_name]
                    status_obj.name = new_name
                    status_obj.save(update_fields=['name'])
                    by_name[new_name] = status_obj
                    del by_name[old_name]
                else:
                    # Target exists, delete obsolete record
                    by_name[old_name].delete()
                    del by_name[old_name]

        # Ensure all standard statuses exist and have proper order and is_default
        for name, is_default, order in STANDARD_STATUSES:
            if name in by_name:
                status_obj = by_name[name]
                if status_obj.order != order or status_obj.is_default != is_default:
                    status_obj.order = order
                    status_obj.is_default = is_default
                    status_obj.save(update_fields=['order', 'is_default'])
            else:
                ProjectStatus.objects.create(
                    project=project,
                    name=name,
                    is_default=is_default,
                    order=order
                )

        # Delete any remaining non-standard status objects for the project
        standard_names = {s[0] for s in STANDARD_STATUSES}
        for s in ProjectStatus.objects.filter(project=project):
            if s.name.lower() not in standard_names:
                s.delete()


def backwards_update_statuses(apps, schema_editor):
    Progress = apps.get_model('tracker', 'Progress')
    Project = apps.get_model('tracker', 'Project')
    ProjectStatus = apps.get_model('tracker', 'ProjectStatus')

    Progress.objects.filter(status__iexact='in progress').update(status='step completed')
    Progress.objects.filter(status__iexact='review').update(status='awaiting review')

    LEGACY_STATUSES = [
        ("todo", True, 0),
        ("planned", False, 1),
        ("step completed", False, 2),
        ("blocked", False, 3),
        ("awaiting review", False, 4),
        ("done", False, 5),
        ("cancelled", False, 6),
    ]

    for project in Project.objects.all():
        ProjectStatus.objects.filter(project=project, name="in progress").update(name="step completed")
        ProjectStatus.objects.filter(project=project, name="review").update(name="awaiting review")


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0007_alter_progress_status_workitemembedding'),
    ]

    operations = [
        migrations.RunPython(forwards_update_statuses, backwards_update_statuses),
        migrations.AlterField(
            model_name='progress',
            name='status',
            field=models.CharField(
                choices=[
                    ('todo', 'Todo'),
                    ('planned', 'Planned'),
                    ('in progress', 'In Progress'),
                    ('blocked', 'Blocked'),
                    ('review', 'Review'),
                    ('done', 'Done'),
                    ('cancelled', 'Cancelled')
                ],
                default='in progress',
                max_length=30
            ),
        ),
    ]

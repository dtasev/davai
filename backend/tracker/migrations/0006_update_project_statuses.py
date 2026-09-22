from django.db import migrations


def forwards_update_project_statuses(apps, schema_editor):
    Project = apps.get_model('tracker', 'Project')
    ProjectStatus = apps.get_model('tracker', 'ProjectStatus')

    STANDARD_STATUSES = [
        ("todo", True, 0),
        ("planned", False, 1),
        ("step completed", False, 2),
        ("blocked", False, 3),
        ("awaiting review", False, 4),
        ("done", False, 5),
        ("cancelled", False, 6),
    ]

    legacy_rename = {
        "in progress": "step completed",
        "review": "awaiting review",
        "waiting": "blocked",
    }

    for project in Project.objects.all():
        existing_statuses = list(ProjectStatus.objects.filter(project=project))
        by_name = {s.name.lower(): s for s in existing_statuses}

        # Rename legacy statuses if target doesn't already exist
        for old_name, new_name in legacy_rename.items():
            if old_name in by_name:
                if new_name not in by_name:
                    status_obj = by_name[old_name]
                    status_obj.name = new_name
                    status_obj.save(update_fields=['name'])
                    by_name[new_name] = status_obj
                    del by_name[old_name]
                else:
                    # Target exists, delete obsolete legacy record
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


def backwards_update_project_statuses(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0005_rework_work_item_status'),
    ]

    operations = [
        migrations.RunPython(forwards_update_project_statuses, backwards_update_project_statuses),
    ]

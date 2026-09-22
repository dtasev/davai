from django.db import migrations, models


def forwards_migrate_status_data(apps, schema_editor):
    WorkItem = apps.get_model('tracker', 'WorkItem')
    Progress = apps.get_model('tracker', 'Progress')

    # 1. Standardise existing progress status values to lowercase
    status_mapping = {
        'COMPLETED': 'step completed',
        'IN_PROGRESS': 'step completed',
        'BLOCKED': 'blocked',
        'FAILED': 'failed',
    }
    for p in Progress.objects.all():
        mapped = status_mapping.get(p.status, p.status.lower() if p.status else 'step completed')
        if mapped != p.status:
            p.status = mapped
            p.save(update_fields=['status'])

    # 2. For WorkItems with non-todo status that have no progress entries, create initial progress
    for item in WorkItem.objects.select_related('status', 'created_by').all():
        if item.status:
            st_name = item.status.name.strip().lower()
            if st_name != 'todo' and not item.progress.exists():
                Progress.objects.create(
                    work_item=item,
                    created_by=item.created_by,
                    summary=f"Status set to {st_name}",
                    status=st_name,
                    proof=""
                )


def backwards_migrate_status_data(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0004_alter_progress_options_and_more'),
    ]

    operations = [
        # First expand Progress.status max_length before inserting longer status names
        migrations.AlterField(
            model_name='progress',
            name='status',
            field=models.CharField(
                choices=[
                    ('todo', 'Todo'),
                    ('planned', 'Planned'),
                    ('step completed', 'Step Completed'),
                    ('blocked', 'Blocked'),
                    ('failed', 'Failed'),
                    ('cancelled', 'Cancelled'),
                    ('awaiting review', 'Awaiting Review'),
                    ('done', 'Done')
                ],
                default='step completed',
                max_length=30
            ),
        ),
        migrations.RunPython(forwards_migrate_status_data, backwards_migrate_status_data),
        migrations.RemoveField(
            model_name='workitem',
            name='status',
        ),
    ]

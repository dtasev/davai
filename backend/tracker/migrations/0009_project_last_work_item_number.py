import re
from django.db import migrations, models


def populate_project_last_work_item_numbers(apps, schema_editor):
    Project = apps.get_model('tracker', 'Project')
    WorkItem = apps.get_model('tracker', 'WorkItem')

    for project in Project.objects.all():
        max_num = 0
        for item in WorkItem.objects.filter(project=project).only('key'):
            match = re.search(r'-(\d+)$', item.key)
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num
        project.last_work_item_number = max_num
        project.save(update_fields=['last_work_item_number'])


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0008_update_statuses_to_in_progress_and_review'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='last_work_item_number',
            field=models.PositiveIntegerField(default=0, help_text='Counter for sequential work item keys within this project'),
        ),
        migrations.RunPython(
            populate_project_last_work_item_numbers,
            reverse_code=migrations.RunPython.noop,
        ),
    ]

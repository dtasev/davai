import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0015_rename_progress_hostname_to_agent_hostname'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TrackedItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('item_type', models.CharField(choices=[('incident', 'Incident'), ('work-item', 'Work Item'), ('user-support', 'User Support')], max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('incident', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='tracked_by', to='tracker.incident')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tracked_items', to=settings.AUTH_USER_MODEL)),
                ('work_item', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='tracked_by', to='tracker.workitem')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.AddConstraint(
            model_name='trackeditem',
            constraint=models.UniqueConstraint(condition=models.Q(('work_item__isnull', False)), fields=('user', 'work_item'), name='unique_user_tracked_work_item'),
        ),
        migrations.AddConstraint(
            model_name='trackeditem',
            constraint=models.UniqueConstraint(condition=models.Q(('incident__isnull', False)), fields=('user', 'incident'), name='unique_user_tracked_incident'),
        ),
    ]

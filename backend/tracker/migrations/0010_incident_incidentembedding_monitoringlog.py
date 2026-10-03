import django.db.models.deletion
import pgvector.django.indexes
import pgvector.django.vector
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0009_project_last_work_item_number'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='last_incident_number',
            field=models.PositiveIntegerField(default=0, help_text='Counter for sequential incident keys within this project'),
        ),
        migrations.AddField(
            model_name='project',
            name='last_monitoring_log_number',
            field=models.PositiveIntegerField(default=0, help_text='Counter for sequential monitoring log keys within this project'),
        ),
        migrations.CreateModel(
            name='Incident',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(db_index=True, max_length=40, unique=True)),
                ('title', models.CharField(max_length=255)),
                ('cause', models.TextField(blank=True, help_text='Investigation cause and details of the incident')),
                ('investigation_note', models.TextField(blank=True, help_text='Quick investigation note (specific things to check to confirm/deny recurrence)')),
                ('status', models.CharField(choices=[('reported', 'Reported'), ('ongoing', 'Ongoing'), ('done', 'Done'), ('no longer relevant', 'No Longer Relevant')], default='reported', max_length=30)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_incidents', to=settings.AUTH_USER_MODEL)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='incidents', to='tracker.project')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_incidents', to=settings.AUTH_USER_MODEL)),
                ('work_items', models.ManyToManyField(blank=True, related_name='incidents', to='tracker.workitem')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.CreateModel(
            name='IncidentEmbedding',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('embedding', pgvector.django.vector.VectorField(dimensions=384)),
                ('content_hash', models.CharField(db_index=True, max_length=64)),
                ('embedded_text', models.TextField(blank=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('incident', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='embedding', to='tracker.incident')),
            ],
            options={
                'indexes': [pgvector.django.indexes.HnswIndex(ef_construction=64, fields=['embedding'], m=16, name='incident_vec_hnsw_idx', opclasses=['vector_cosine_ops'])],
            },
        ),
        migrations.CreateModel(
            name='MonitoringLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(db_index=True, max_length=40, unique=True)),
                ('who_are_you', models.CharField(blank=True, help_text='Agent/runner identification filled out by the LLM', max_length=255)),
                ('description', models.TextField(help_text='Description/log of the monitoring run')),
                ('status', models.CharField(choices=[('ok', 'OK'), ('error', 'Error')], default='ok', max_length=20)),
                ('jira_url', models.CharField(blank=True, help_text='Link to a JIRA incident if one is found', max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_monitoring_logs', to=settings.AUTH_USER_MODEL)),
                ('incident', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='monitoring_logs', to='tracker.incident')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='monitoring_logs', to='tracker.project')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0014_progress_hostname'),
    ]

    operations = [
        migrations.RenameField(
            model_name='progress',
            old_name='hostname',
            new_name='agent_hostname',
        ),
        migrations.AlterField(
            model_name='progress',
            name='agent_hostname',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Optional hostname of the machine on which the agent is running so the user can find the session again',
                max_length=255,
            ),
        ),
    ]

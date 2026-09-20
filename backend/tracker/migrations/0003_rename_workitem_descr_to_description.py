from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0002_rename_context_progress_t_to_summary'),
    ]

    operations = [
        migrations.RenameField(
            model_name='workitem',
            old_name='descr',
            new_name='description',
        ),
    ]

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('tracker', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='context',
            old_name='t',
            new_name='summary',
        ),
        migrations.RenameField(
            model_name='progress',
            old_name='t',
            new_name='summary',
        ),
    ]

"""
Data step for 0003: events stored before received_at existed got the migration
time; their best known arrival time is created_at. Kept separate from the schema
change (DDL vs DML). Reverse is a no-op: 0003's reverse drops the column.
"""

from django.db import migrations
from django.db.models import F


def copy_created_at(apps, schema_editor):
    ListeningEvent = apps.get_model("analytics", "ListeningEvent")
    ListeningEvent.objects.update(received_at=F("created_at"))


class Migration(migrations.Migration):
    dependencies = [
        ("analytics", "0003_playbackstate_event_times"),
    ]

    operations = [
        migrations.RunPython(copy_created_at, migrations.RunPython.noop),
    ]

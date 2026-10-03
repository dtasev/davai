from django.core.management.base import BaseCommand
from tracker.models import WorkItem, Incident
from tracker.embedding import (
    index_work_item,
    index_incident,
    compute_content_hash,
    format_work_item_text,
    format_incident_text,
)


class Command(BaseCommand):
    help = "Generates and stores vector embeddings for work items and incidents."

    def add_arguments(self, parser):
        parser.add_argument(
            "--project",
            type=str,
            help="Filter by project key (e.g. DAV).",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=50,
            help="Number of items to process in each batch.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force re-generation of embeddings even if content hash has not changed.",
        )

    def handle(self, *args, **options):
        project_key = options.get("project")
        batch_size = options.get("batch_size", 50)
        force = options.get("force", False)

        qs = WorkItem.objects.select_related("project", "context").prefetch_related("progress").order_by("id")
        inc_qs = Incident.objects.select_related("project").exclude(status="no longer relevant").order_by("id")

        if project_key:
            qs = qs.filter(project__key=project_key.upper())
            inc_qs = inc_qs.filter(project__key=project_key.upper())

        total = qs.count()
        self.stdout.write(f"Found {total} work items to evaluate for embeddings.")

        created_or_updated = 0
        skipped = 0
        errors = 0

        for item in qs.iterator(chunk_size=batch_size):
            try:
                text = format_work_item_text(item)
                chash = compute_content_hash(text)
                emb = getattr(item, "embedding", None)

                if not force and emb and emb.content_hash == chash:
                    skipped += 1
                    continue

                index_work_item(item, force=force)
                created_or_updated += 1
                if created_or_updated % 10 == 0:
                    self.stdout.write(f"Processed {created_or_updated}/{total} items...")
            except Exception as e:
                errors += 1
                self.stderr.write(self.style.ERROR(f"Error indexing item {item.key}: {e}"))

        inc_total = inc_qs.count()
        inc_updated = 0
        inc_skipped = 0
        inc_errors = 0
        if inc_total:
            self.stdout.write(f"Found {inc_total} incidents to evaluate for embeddings.")
            for incident in inc_qs.iterator(chunk_size=batch_size):
                try:
                    text = format_incident_text(incident)
                    chash = compute_content_hash(text)
                    emb = getattr(incident, "embedding", None)

                    if not force and emb and emb.content_hash == chash:
                        inc_skipped += 1
                        continue

                    index_incident(incident, force=force)
                    inc_updated += 1
                except Exception as e:
                    inc_errors += 1
                    self.stderr.write(self.style.ERROR(f"Error indexing incident {incident.key}: {e}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"Embedding backfill complete. Work items — Total: {total}, Updated: {created_or_updated}, Skipped: {skipped}, Errors: {errors}. "
                f"Incidents — Total: {inc_total}, Updated: {inc_updated}, Skipped: {inc_skipped}, Errors: {inc_errors}."
            )
        )


from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from tracker.models import Project, WorkItem, APIKey
from tracker.auth import generate_api_key

class Command(BaseCommand):
    help = "Seed initial project, users, work items, and API key"

    def handle(self, *args, **options):
        # 1. Ensure admin user exists
        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={"email": "admin@dtasev.co.uk", "is_staff": True, "is_superuser": True}
        )
        if created:
            admin_user.set_password("admin")
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("Created admin user (password: admin)"))

        # 2. Ensure dimitar user exists
        dimitar_user, created = User.objects.get_or_create(
            username="dimitar",
            defaults={"email": "dimitar@dtasev.co.uk", "is_staff": True}
        )
        if created:
            dimitar_user.set_password("dimitar123")
            dimitar_user.save()
            self.stdout.write(self.style.SUCCESS("Created dimitar user"))

        # 3. Ensure Project exists
        project, created = Project.objects.get_or_create(
            key="DAV",
            defaults={
                "name": "Davai Workspace",
                "description": "Next-generation Jira-like project tracking platform"
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created project: {project}"))

        # 4. Seed Work Items
        seed_tickets = [
            ("DAV-1", "Configure Nginx reverse proxy & Cloudflared tunnel target", "DONE", "HIGH", dimitar_user),
            ("DAV-2", "Set up Django Ninja 1.7+ & Python 3.14 backend API", "DONE", "HIGH", dimitar_user),
            ("DAV-3", "Build React 19 + Vite 8 Kanban board interface", "IN_PROGRESS", "MEDIUM", dimitar_user),
            ("DAV-4", "Connect Authelia WebAuthn / Passkey auth flow", "DONE", "HIGH", dimitar_user),
            ("DAV-5", "Add Strawberry GraphQL schema & GraphiQL IDE support", "DONE", "MEDIUM", dimitar_user),
            ("DAV-6", "Implement MCP Server interface for LLM agents", "DONE", "HIGH", None),
            ("DAV-7", "Implement User & API Key authentication with Django ORM", "IN_PROGRESS", "HIGH", dimitar_user),
        ]

        for key, title, status, priority, assignee in seed_tickets:
            item, created = WorkItem.objects.get_or_create(
                key=key,
                defaults={
                    "project": project,
                    "title": title,
                    "status": status,
                    "priority": priority,
                    "assignee": assignee,
                    "reporter": admin_user,
                }
            )
            if created:
                self.stdout.write(f"  + Seeded {key}: {title}")

        # 5. Ensure at least one active API Key exists
        active_key = APIKey.objects.filter(user=admin_user, is_active=True).first()
        if not active_key:
            api_key, raw_key = generate_api_key(admin_user, name="Initial Admin Key")
            self.stdout.write(self.style.SUCCESS("=" * 60))
            self.stdout.write(self.style.SUCCESS(f"PROVISIONED NEW API KEY for user '{admin_user.username}':"))
            self.stdout.write(self.style.WARNING(f"  {raw_key}"))
            self.stdout.write(self.style.SUCCESS("Save this key! It will not be shown again in full."))
            self.stdout.write(self.style.SUCCESS("=" * 60))
        else:
            self.stdout.write(f"Active API key already exists for {admin_user.username}: {active_key.prefix}...")

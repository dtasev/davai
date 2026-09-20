import os
import sys
from pathlib import Path
import pytest
from django.conf import settings
from django.db import connection

def _check_db_safety(db_name: str, origin: str):
    """
    Strict safety check: The database name or filename MUST start with 'test_'.
    If not, abort execution immediately to prevent deleting user's local database.
    """
    if not db_name:
        pytest.exit(f"CRITICAL SAFETY VIOLATION: No database name configured ({origin}). Aborting!", returncode=1)

    db_str = str(db_name)

    # In-memory test databases are safe
    if db_str == ":memory:":
        return

    filename = Path(db_str).name
    if not filename.startswith("test_"):
        msg = (
            f"\n{'='*70}\n"
            f"CRITICAL SAFETY VIOLATION [{origin}]:\n"
            f"Active database filename '{filename}' DOES NOT start with 'test_'.\n"
            f"Full path: '{db_str}'.\n"
            f"Execution halted immediately to prevent deleting or altering user's local database!\n"
            f"{'='*70}\n"
        )
        sys.stderr.write(msg)
        pytest.exit(msg, returncode=1)

def pytest_configure(config):
    """Early configuration-phase check."""
    if not settings.configured:
        return

    default_db = settings.DATABASES.get("default", {})
    test_db = default_db.get("TEST", {}).get("NAME")
    main_db = default_db.get("NAME")

    # If running pytest-django, the target test DB will be test_db or main_db
    target_name = test_db or main_db
    if target_name:
        _check_db_safety(str(target_name), origin="pytest_configure (Target Test DB)")

@pytest.fixture(scope="session", autouse=True)
def enforce_test_db_guard(django_db_setup, django_db_blocker):
    """
    Runtime check once the Django test database connection is established.
    Verifies that the actual active database connection name strictly starts with 'test_'.
    """
    with django_db_blocker.unblock():
        active_db_name = connection.settings_dict.get("NAME")
        _check_db_safety(str(active_db_name), origin="Runtime DB Connection")

# ---------------------------------------------------------------------------
# Framework-Native Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def ninja_client():
    """Django Ninja native TestClient instance."""
    from ninja.testing import TestClient
    from tracker.api import api
    return TestClient(api)

@pytest.fixture
def test_user(db):
    """Provides a standard test user."""
    from django.contrib.auth.models import User
    user, _ = User.objects.get_or_create(
        username="testuser",
        defaults={"email": "testuser@dtasev.co.uk", "is_staff": True}
    )
    return user

@pytest.fixture
def test_project(db):
    """Provides a standard test project."""
    from tracker.models import Project
    project, _ = Project.objects.get_or_create(
        key="DAV",
        defaults={"name": "Davai Test Workspace", "description": "Test Workspace"}
    )
    return project

@pytest.fixture
def test_api_key(db, test_user):
    """Generates an active API key for test_user and returns (APIKey, raw_key)."""
    from tracker.auth import generate_api_key
    return generate_api_key(test_user, name="Pytest Key")

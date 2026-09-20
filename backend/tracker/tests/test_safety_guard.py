import pytest
from conftest import _check_db_safety

class TestDatabaseSafetyGuard:
    def test_safe_database_names_pass(self):
        # Valid test database names should not exit
        _check_db_safety("test_db.sqlite3", origin="UnitTest")
        _check_db_safety("/app/data/test_davai.sqlite3", origin="UnitTest")
        _check_db_safety(":memory:", origin="UnitTest")

    def test_unsafe_database_names_aborted(self):
        # Unsafe database names (not starting with test_) must call pytest.exit()
        with pytest.raises(pytest.exit.Exception) as exc_info:
            _check_db_safety("db.sqlite3", origin="UnitTest")
        assert "CRITICAL SAFETY VIOLATION" in str(exc_info.value)

        with pytest.raises(pytest.exit.Exception) as exc_info2:
            _check_db_safety("/var/data/production.sqlite3", origin="UnitTest")
        assert "CRITICAL SAFETY VIOLATION" in str(exc_info2.value)

        with pytest.raises(pytest.exit.Exception) as exc_info3:
            _check_db_safety("", origin="UnitTest")
        assert "CRITICAL SAFETY VIOLATION" in str(exc_info3.value)

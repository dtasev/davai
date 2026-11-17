import io
import importlib
import logging

from tracker.log_redaction import MASK, CredentialRedactionFilter, redact


class TestRedact:
    def test_masks_websocket_token_query_credential(self):
        line = '10.0.0.1 - "GET /ws?client_id=abc&token=dav_live_abc123def456 HTTP/1.1" 101'
        out = redact(line)

        assert "dav_live_abc123def456" not in out
        assert f"token={MASK}" in out
        assert "client_id=abc" in out  # non-credential params survive

    def test_masks_mcp_api_key_query_credential(self):
        out = redact('POST "/mcp/?api_key=dav_live_deadbeefdeadbeef HTTP/1.1"')

        assert "deadbeef" not in out
        assert f"api_key={MASK}" in out

    def test_masks_authorization_header_value_but_keeps_the_name(self):
        out = redact('headers={"Authorization": "Bearer dav_live_abc123def456"}')

        assert "abc123def456" not in out
        assert "Authorization" in out

    def test_masks_x_api_key_header_value(self):
        out = redact("X-API-Key: dav_live_0123456789abcdef")

        assert "0123456789abcdef" not in out

    def test_masks_a_bare_key_appearing_anywhere(self):
        out = redact("generated key dav_live_aaaabbbbccccddddeeeeffff00001111 for user")

        assert "aaaabbbb" not in out
        assert MASK in out

    def test_leaves_ordinary_messages_untouched(self):
        message = "Work item DAV-1 created by madt with 3 progress entries"

        assert redact(message) == message


class TestCredentialRedactionFilter:
    def test_filter_renders_args_then_scrubs_them(self):
        record = logging.LogRecord(
            name="uvicorn.access",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg='%s - "%s %s" %s',
            args=("10.0.0.1", "GET", "/ws?token=dav_live_abc123def456abc123", "101"),
            exc_info=None,
        )

        assert CredentialRedactionFilter().filter(record) is True
        assert "abc123def456" not in record.getMessage()
        # Args are cleared so a second handler cannot re-render the secret.
        assert record.args is None

    def test_filter_passes_unmatched_records_through(self):
        record = logging.LogRecord(
            name="tracker", level=logging.INFO, pathname=__file__, lineno=1,
            msg="health check ok", args=None, exc_info=None,
        )

        assert CredentialRedactionFilter().filter(record) is True
        assert record.getMessage() == "health check ok"

    def test_handler_emits_only_redacted_text(self):
        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(logging.Formatter("%(message)s"))
        handler.addFilter(CredentialRedactionFilter())

        logger = logging.getLogger("davai.test.redaction.sink")
        previous = logger.handlers
        previous_level = logger.level
        logger.handlers = [handler]
        logger.setLevel(logging.INFO)
        logger.propagate = False
        try:
            logger.info('GET /mcp/?api_key=dav_live_abc123def456abc123def456 -> 200')
        finally:
            logger.handlers = previous
            logger.setLevel(previous_level)

        emitted = stream.getvalue()
        assert emitted, "the handler must actually have emitted a record"
        assert "abc123def456" not in emitted
        assert MASK in emitted


def test_logging_config_references_a_real_filter_class():
    """settings.LOGGING must name an importable filter, or Django fails to start."""
    from django.conf import settings

    # Resolved the same way dictConfig resolves it, without reconfiguring the
    # process-wide logging state (other tests still need their handlers).
    spec = settings.LOGGING["filters"]["redact_credentials"]["()"]
    module_path, class_name = spec.rsplit(".", 1)

    assert getattr(importlib.import_module(module_path), class_name) is CredentialRedactionFilter
    assert "redact_credentials" in settings.LOGGING["handlers"]["console"]["filters"]
    assert "uvicorn.access" in settings.LOGGING["loggers"]

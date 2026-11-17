"""Credential redaction for log output.

API keys are accepted in URLs on the WebSocket (``/ws?token=...``) and MCP
(``/mcp/?token=...``, ``/mcp/?api_key=...``) endpoints, so any log line that
carries a request line can carry a live credential. This filter masks those
values wherever they appear in a rendered message, so access logging can stay
switched on without writing secrets to stdout.
"""

import logging
import re

MASK = "***redacted***"

# Query-string and header credential pairs, plus bare keys, matched against the
# rendered message so %s-interpolated arguments are covered too.
_QUERY_CREDENTIAL = re.compile(r"(?i)([?&](?:token|api_key)=)([^&\s\"']+)")
_HEADER_CREDENTIAL = re.compile(
    r"(?i)(\"?)(authorization|x-api-key)(\"?\s*[:=]\s*)(?:Bearer\s+)?([^\s\"',}\)]+)"
)
_BARE_API_KEY = re.compile(r"dav_live_[0-9a-fA-F]{8,}")


def redact(text: str) -> str:
    """Return *text* with query-string credentials, auth headers and bare keys masked."""
    text = _QUERY_CREDENTIAL.sub(lambda m: m.group(1) + MASK, text)
    text = _HEADER_CREDENTIAL.sub(
        lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}{MASK}", text
    )
    text = _BARE_API_KEY.sub(MASK, text)
    return text


class CredentialRedactionFilter(logging.Filter):
    """Masks credentials in every record that passes through the attached handler."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            # A record that cannot be rendered is not a reason to drop it; the
            # handler will surface its own formatting error as usual.
            return True

        redacted = redact(message)
        if redacted != message:
            # Assigning the rendered text and clearing args guarantees the secret
            # is not re-rendered by a later handler that formats the same record.
            record.msg = redacted
            record.args = None
        return True

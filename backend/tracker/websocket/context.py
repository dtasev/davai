import contextvars
from typing import Optional

_current_client_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_client_id", default=None
)

def get_current_client_id() -> Optional[str]:
    """Retrieve the client ID associated with the current HTTP request thread/coroutine."""
    return _current_client_id_var.get()

def set_current_client_id(client_id: Optional[str]):
    """Set the client ID for the current context and return a reset token."""
    return _current_client_id_var.set(client_id)

def reset_current_client_id(token):
    """Reset the client ID contextvar using a previous token."""
    _current_client_id_var.reset(token)

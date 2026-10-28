from .context import set_current_client_id, reset_current_client_id

class WebSocketClientIdMiddleware:
    """
    Captures X-Davai-Client-ID (or X-Client-ID) from incoming HTTP requests
    and stores it in contextvars for downstream echo suppression.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        client_id = (
            request.headers.get("x-davai-client-id")
            or request.headers.get("x-client-id")
            or request.META.get("HTTP_X_DAVAI_CLIENT_ID")
            or request.META.get("HTTP_X_CLIENT_ID")
        )
        token = set_current_client_id(client_id)
        try:
            return self.get_response(request)
        finally:
            reset_current_client_id(token)

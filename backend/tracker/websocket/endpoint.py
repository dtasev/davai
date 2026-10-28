import asyncio
import json
import logging
import uuid
from typing import Optional
from urllib.parse import urlparse
from starlette.websockets import WebSocket, WebSocketDisconnect
from asgiref.sync import sync_to_async
from django.utils import timezone
from tracker.auth import verify_api_key
from .manager import manager

logger = logging.getLogger(__name__)


class SessionLookupError(Exception):
    """Raised when the session lookup itself fails (database down, decode error).

    Distinct from "no valid session", which returns None: one means the caller cannot be
    verified right now, the other means the caller presented no usable credentials.
    """


@sync_to_async
def get_user_from_session(session_key: str):
    """Attempt to resolve user from Django session store.

    Returns None when the session is absent/expired/invalid. Raises SessionLookupError when
    the lookup cannot be performed, so a transient backend failure is not reported to the
    client as "you are not authenticated" (which is not retried).
    """
    if not session_key:
        return None
    try:
        from django.contrib.sessions.models import Session
        from django.contrib.auth import get_user_model
        session = Session.objects.filter(
            session_key=session_key,
            expire_date__gte=timezone.now()
        ).first()
        if session:
            session_data = session.get_decoded()
            user_id = session_data.get("_auth_user_id")
            if user_id:
                User = get_user_model()
                return User.objects.filter(id=user_id, is_active=True).first()
    except Exception as e:
        logger.warning("Session lookup failed for websocket connection: %s", e)
        raise SessionLookupError() from e
    return None


def origin_allowed(websocket: WebSocket) -> bool:
    """Reject cross-origin browser handshakes.

    Cookie-authenticated WebSockets are not covered by the same-origin policy, so a browser
    client must prove it comes from this very host. Non-browser clients (MCP agents) send no
    Origin header at all and are allowed through.
    """
    origin = websocket.headers.get("origin")
    if not origin:
        return True
    host = websocket.headers.get("host")
    if not host:
        return False
    try:
        return urlparse(origin).netloc.lower() == host.lower()
    except ValueError:
        return False


async def websocket_endpoint(websocket: WebSocket):
    try:
        manager.set_loop(asyncio.get_running_loop())
    except Exception:
        pass

    query_params = websocket.query_params
    client_id = query_params.get("client_id") or str(uuid.uuid4())

    # Reject cross-origin browser handshakes before doing any authentication work.
    if not origin_allowed(websocket):
        await websocket.accept()
        await websocket.send_json({
            "event": "error",
            "code": "origin_not_allowed",
            "message": "Origin not allowed.",
        })
        await websocket.close(code=1008)
        return

    # Authentication resolution
    user = None
    token = query_params.get("token") or query_params.get("api_key")
    if token:
        user = await sync_to_async(verify_api_key)(token)

    if not user:
        session_id = websocket.cookies.get("sessionid")
        if session_id:
            try:
                user = await get_user_from_session(session_id)
            except SessionLookupError:
                # Cannot verify right now (database unavailable, decode failure). Tell the
                # client to retry instead of closing with 1008, which means "you are not
                # authenticated" and stops its reconnect loop for good.
                await websocket.accept()
                await websocket.send_json({
                    "event": "error",
                    "code": "authentication_unavailable",
                    "message": "Authentication temporarily unavailable.",
                })
                await websocket.close(code=1011)
                return

    # WebSocket access is authenticated-only. Accept first so the client receives an explicit
    # error frame and a policy-violation close code (1008), which the frontend uses to stop its
    # reconnect loop instead of retrying forever against a socket it can never open.
    if user is None:
        await websocket.accept()
        await websocket.send_json({
            "event": "error",
            "code": "authentication_required",
            "message": "Authentication required.",
        })
        await websocket.close(code=1008)
        return

    user_id = user.id
    await manager.connect(websocket, client_id=client_id, user_id=user_id)

    # Automatically subscribe authenticated user to their personal notification channel
    await manager.subscribe(websocket, f"user:{user_id}")

    # Confirm connection to client
    await websocket.send_json({
        "event": "connected",
        "client_id": client_id,
        "authenticated": True,
        "username": user.username,
    })

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                continue

            action = msg.get("action")
            if action == "subscribe":
                topic = msg.get("topic", "")
                if topic:
                    # Guard personal user topics
                    if topic.startswith("user:"):
                        try:
                            target_id = int(topic.split(":", 1)[1])
                            if user_id != target_id:
                                await websocket.send_json({
                                    "event": "error",
                                    "message": "Unauthorized to subscribe to another user's channel."
                                })
                                continue
                        except ValueError:
                            continue
                    await manager.subscribe(websocket, topic)
                    await websocket.send_json({"event": "subscribed", "topic": topic})

            elif action == "unsubscribe":
                topic = msg.get("topic", "")
                if topic:
                    await manager.unsubscribe(websocket, topic)
                    await websocket.send_json({"event": "unsubscribed", "topic": topic})

            elif action == "ping":
                await websocket.send_json({"event": "pong"})

    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.debug("WebSocket connection error: %s", e)
        await manager.disconnect(websocket)

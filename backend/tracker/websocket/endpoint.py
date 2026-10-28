import json
import logging
import uuid
from typing import Optional
from starlette.websockets import WebSocket, WebSocketDisconnect
from asgiref.sync import sync_to_async
from django.utils import timezone
from tracker.auth import verify_api_key
from .manager import manager

logger = logging.getLogger(__name__)

@sync_to_async
def get_user_from_session(session_key: str):
    """Attempt to resolve user from Django session store."""
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
        logger.debug("Failed resolving user from session cookie: %s", e)
    return None

async def websocket_endpoint(websocket: WebSocket):
    try:
        manager.set_loop(asyncio.get_running_loop())
    except Exception:
        pass

    query_params = websocket.query_params
    client_id = query_params.get("client_id") or str(uuid.uuid4())

    # Authentication resolution
    user = None
    token = query_params.get("token") or query_params.get("api_key")
    if token:
        user = await sync_to_async(verify_api_key)(token)

    if not user:
        session_id = websocket.cookies.get("sessionid")
        if session_id:
            user = await get_user_from_session(session_id)

    user_id = user.id if user else None
    await manager.connect(websocket, client_id=client_id, user_id=user_id)

    # Automatically subscribe authenticated user to their personal notification channel
    if user_id is not None:
        await manager.subscribe(websocket, f"user:{user_id}")

    # Confirm connection to client
    await websocket.send_json({
        "event": "connected",
        "client_id": client_id,
        "authenticated": user is not None,
        "username": user.username if user else None,
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

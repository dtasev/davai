import asyncio
import logging
from typing import Dict, Set, Optional, Any
from starlette.websockets import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    In-memory async connection hub for managing connected WebSocket clients,
    room/topic subscriptions, and message fan-out with client echo suppression.
    """
    def __init__(self):
        # topic -> set of WebSocket connections
        self._rooms: Dict[str, Set[WebSocket]] = {}
        # websocket -> set of topics
        self._client_topics: Dict[WebSocket, Set[str]] = {}
        # websocket -> client_id string
        self._client_ids: Dict[WebSocket, str] = {}
        # websocket -> user_id (optional)
        self._client_users: Dict[WebSocket, Optional[int]] = {}
        # user_id -> set of WebSocket connections
        self._user_clients: Dict[int, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def get_loop(self) -> Optional[asyncio.AbstractEventLoop]:
        if self._loop and self._loop.is_running():
            return self._loop
        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            return None

    async def connect(self, websocket: WebSocket, client_id: str, user_id: Optional[int] = None):
        await websocket.accept()
        async with self._lock:
            self._client_topics[websocket] = set()
            self._client_ids[websocket] = client_id
            self._client_users[websocket] = user_id
            if user_id is not None:
                if user_id not in self._user_clients:
                    self._user_clients[user_id] = set()
                self._user_clients[user_id].add(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            topics = self._client_topics.pop(websocket, set())
            client_id = self._client_ids.pop(websocket, None)
            user_id = self._client_users.pop(websocket, None)

            if user_id is not None and user_id in self._user_clients:
                self._user_clients[user_id].discard(websocket)
                if not self._user_clients[user_id]:
                    del self._user_clients[user_id]

            for topic in topics:
                if topic in self._rooms:
                    self._rooms[topic].discard(websocket)
                    if not self._rooms[topic]:
                        del self._rooms[topic]

    async def subscribe(self, websocket: WebSocket, topic: str):
        clean_topic = topic.strip()
        if not clean_topic:
            return
        async with self._lock:
            if websocket not in self._client_topics:
                return
            if clean_topic not in self._rooms:
                self._rooms[clean_topic] = set()
            self._rooms[clean_topic].add(websocket)
            self._client_topics[websocket].add(clean_topic)

    async def unsubscribe(self, websocket: WebSocket, topic: str):
        clean_topic = topic.strip()
        async with self._lock:
            if clean_topic in self._rooms:
                self._rooms[clean_topic].discard(websocket)
                if not self._rooms[clean_topic]:
                    del self._rooms[clean_topic]
            if websocket in self._client_topics:
                self._client_topics[websocket].discard(clean_topic)

    async def broadcast(
        self,
        topic: str,
        message: Dict[str, Any],
        exclude_client_id: Optional[str] = None
    ):
        clean_topic = topic.strip()
        async with self._lock:
            recipients = list(self._rooms.get(clean_topic, set()))

        dead_sockets = []
        for ws in recipients:
            cid = self._client_ids.get(ws)
            if exclude_client_id and cid == exclude_client_id:
                continue
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.debug("Failed to send message to websocket client: %s", e)
                dead_sockets.append(ws)

        if dead_sockets:
            for ws in dead_sockets:
                await self.disconnect(ws)

    async def send_personal(self, user_id: int, message: Dict[str, Any]):
        async with self._lock:
            recipients = list(self._user_clients.get(user_id, set()))

        dead_sockets = []
        for ws in recipients:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.debug("Failed to send personal message to websocket: %s", e)
                dead_sockets.append(ws)

        if dead_sockets:
            for ws in dead_sockets:
                await self.disconnect(ws)

    def broadcast_sync(
        self,
        topic: str,
        message: Dict[str, Any],
        exclude_client_id: Optional[str] = None
    ):
        """
        Thread-safe entry point to broadcast messages from synchronous Django signals or views.
        """
        loop = self.get_loop()
        if not loop or not loop.is_running():
            return

        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        coro = self.broadcast(topic, message, exclude_client_id)
        if current_loop == loop:
            loop.create_task(coro)
        else:
            asyncio.run_coroutine_threadsafe(coro, loop)

manager = ConnectionManager()

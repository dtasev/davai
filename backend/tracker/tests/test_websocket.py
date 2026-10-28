import pytest
import asyncio
from unittest.mock import AsyncMock
from asgiref.sync import sync_to_async
from starlette.testclient import TestClient
from django.contrib.auth.models import User
from core.asgi import application
from tracker.models import Project, WorkItem, Progress, Incident, MonitoringLog, Sprint, Release
from tracker.auth import generate_api_key
from tracker.websocket.manager import ConnectionManager
from tracker.websocket.context import set_current_client_id, reset_current_client_id

@pytest.mark.django_db(transaction=True)
class TestWebSocketDirect:
    @pytest.fixture(autouse=True)
    def setup_data(self):
        self.user = User.objects.create_user(username="wsuser", password="password123")
        self.project = Project.objects.create(key="WSPROJ", name="WS Project")
        self.api_key_obj, self.raw_key = generate_api_key(self.user, name="WS Test Key")

    def test_endpoint_connect_and_auth(self):
        client = TestClient(application)
        with client.websocket_connect(f"/ws?client_id=client-auth&token={self.raw_key}") as ws:
            data = ws.receive_json()
            assert data["event"] == "connected"
            assert data["client_id"] == "client-auth"
            assert data["authenticated"] is True
            assert data["username"] == "wsuser"

            ws.send_json({"action": "subscribe", "topic": "project:WSPROJ"})
            ack = ws.receive_json()
            assert ack["event"] == "subscribed"
            assert ack["topic"] == "project:WSPROJ"

            ws.send_json({"action": "ping"})
            pong = ws.receive_json()
            assert pong["event"] == "pong"

            ws.send_json({"action": "unsubscribe", "topic": "project:WSPROJ"})
            unack = ws.receive_json()
            assert unack["event"] == "unsubscribed"

    @pytest.mark.asyncio
    async def test_manager_subscription_and_broadcast(self):
        mgr = ConnectionManager()
        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await mgr.connect(ws1, client_id="client-1", user_id=1)
        await mgr.connect(ws2, client_id="client-2", user_id=2)

        await mgr.subscribe(ws1, "project:WSPROJ")
        await mgr.subscribe(ws2, "project:WSPROJ")

        # Broadcast to room
        await mgr.broadcast("project:WSPROJ", {"event": "test"})
        ws1.send_json.assert_awaited_once_with({"event": "test"})
        ws2.send_json.assert_awaited_once_with({"event": "test"})

        # Unsubscribe ws1
        await mgr.unsubscribe(ws1, "project:WSPROJ")
        ws1.send_json.reset_mock()
        ws2.send_json.reset_mock()

        await mgr.broadcast("project:WSPROJ", {"event": "test2"})
        ws1.send_json.assert_not_awaited()
        ws2.send_json.assert_awaited_once_with({"event": "test2"})

    @pytest.mark.asyncio
    async def test_manager_echo_suppression(self):
        mgr = ConnectionManager()
        ws_sender = AsyncMock()
        ws_receiver = AsyncMock()

        await mgr.connect(ws_sender, client_id="sender-client")
        await mgr.connect(ws_receiver, client_id="receiver-client")

        await mgr.subscribe(ws_sender, "project:WSPROJ")
        await mgr.subscribe(ws_receiver, "project:WSPROJ")

        # Broadcast with exclude_client_id="sender-client"
        await mgr.broadcast(
            "project:WSPROJ",
            {"event": "work_item.updated"},
            exclude_client_id="sender-client"
        )

        ws_sender.send_json.assert_not_awaited()
        ws_receiver.send_json.assert_awaited_once_with({"event": "work_item.updated"})

    @pytest.mark.asyncio
    async def test_domain_model_signals_and_echo(self):
        from tracker.websocket.manager import manager as real_manager

        loop = asyncio.get_running_loop()
        real_manager.set_loop(loop)

        mock_ws = AsyncMock()
        await real_manager.connect(mock_ws, client_id="listener-client")
        await real_manager.subscribe(mock_ws, "project:WSPROJ")

        # 1. Create WorkItem with sender echo suppression
        token = set_current_client_id("editor-client")
        try:
            item = await sync_to_async(WorkItem.objects.create)(
                project=self.project,
                key="WSPROJ-201",
                title="Signal Work Item",
                priority="HIGH",
                created_by=self.user
            )
        finally:
            reset_current_client_id(token)

        await asyncio.sleep(0.05)
        assert mock_ws.send_json.await_count >= 1
        last_call_arg = mock_ws.send_json.call_args[0][0]
        assert last_call_arg["event"] == "work_item.created"
        assert last_call_arg["key"] == "WSPROJ-201"
        assert last_call_arg["origin_client_id"] == "editor-client"

        # 2. Add progress entry
        mock_ws.send_json.reset_mock()
        prog = await sync_to_async(Progress.objects.create)(
            work_item=item,
            summary="Progress test",
            proof="sha1",
            status="in progress",
            agent_id="test-agent",
            created_by=self.user
        )
        await asyncio.sleep(0.05)

        assert mock_ws.send_json.await_count >= 1
        prog_call_arg = mock_ws.send_json.call_args[0][0]
        assert prog_call_arg["event"] == "progress.created"
        assert prog_call_arg["progress"]["summary"] == "Progress test"

        # 3. Create Incident
        mock_ws.send_json.reset_mock()
        incident = await sync_to_async(Incident.objects.create)(
            project=self.project,
            key="WSPROJ-INC-1",
            title="Service Outage",
            status="investigating",
            created_by=self.user
        )
        await asyncio.sleep(0.05)
        assert mock_ws.send_json.await_count >= 1
        inc_call_arg = mock_ws.send_json.call_args[0][0]
        assert inc_call_arg["event"] == "incident.created"
        assert inc_call_arg["key"] == "WSPROJ-INC-1"

        # 4. Create MonitoringLog
        mock_ws.send_json.reset_mock()
        log = await sync_to_async(MonitoringLog.objects.create)(
            project=self.project,
            key="WSPROJ-LOG-1",
            description="502 Bad Gateway observed",
            status="firing",
            incident=incident,
            created_by=self.user
        )
        await asyncio.sleep(0.05)
        assert mock_ws.send_json.await_count >= 1
        log_call_arg = mock_ws.send_json.call_args[0][0]
        assert log_call_arg["event"] == "monitoring_log.created"
        assert log_call_arg["key"] == "WSPROJ-LOG-1"

        # 5. Create Sprint and Release
        mock_ws.send_json.reset_mock()
        sprint = await sync_to_async(Sprint.objects.create)(
            project=self.project,
            name="Sprint 10"
        )
        await asyncio.sleep(0.05)
        assert mock_ws.send_json.await_count >= 1
        sprint_call_arg = mock_ws.send_json.call_args[0][0]
        assert sprint_call_arg["event"] == "sprint.created"
        assert sprint_call_arg["sprint"]["name"] == "Sprint 10"

        # 6. Delete work item
        mock_ws.send_json.reset_mock()
        await sync_to_async(item.delete)()
        await asyncio.sleep(0.05)

        assert mock_ws.send_json.await_count >= 1
        del_call_arg = mock_ws.send_json.call_args[0][0]
        assert del_call_arg["event"] == "work_item.deleted"
        assert del_call_arg["key"] == "WSPROJ-201"

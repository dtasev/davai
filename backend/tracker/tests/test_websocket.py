import pytest
import asyncio
from unittest.mock import AsyncMock
from asgiref.sync import sync_to_async
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from django.contrib.auth.models import User
from core.asgi import application
from tracker.models import Project, WorkItem, Progress, Incident, MonitoringLog, Sprint, Release, TrackedItem
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

    def test_endpoint_rejects_anonymous_connection(self):
        client = TestClient(application)
        with client.websocket_connect("/ws?client_id=anon-client") as ws:
            msg = ws.receive_json()
            assert msg["event"] == "error"
            assert msg["code"] == "authentication_required"

            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_json()
        assert exc_info.value.code == 1008

    def test_endpoint_authenticates_via_session_cookie(self):
        # The SPA never sends ?token=; it relies on the sessionid cookie, so this is the path
        # that has to keep working in production.
        from django.contrib.sessions.backends.db import SessionStore

        session = SessionStore()
        session["_auth_user_id"] = str(self.user.pk)
        session["_auth_user_backend"] = "django.contrib.auth.backends.ModelBackend"
        session["_auth_user_hash"] = self.user.get_session_auth_hash()
        session.create()

        client = TestClient(application, cookies={"sessionid": session.session_key})
        with client.websocket_connect("/ws?client_id=cookie-client") as ws:
            data = ws.receive_json()
            assert data["event"] == "connected"
            assert data["authenticated"] is True
            assert data["username"] == "wsuser"

    def test_endpoint_rejects_cross_origin_browser_handshake(self):
        client = TestClient(application)
        with client.websocket_connect(
            f"/ws?client_id=evil&token={self.raw_key}",
            headers={"Origin": "https://evil.example"},
        ) as ws:
            msg = ws.receive_json()
            assert msg["event"] == "error"
            assert msg["code"] == "origin_not_allowed"

            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_json()
        assert exc_info.value.code == 1008

    def test_endpoint_uses_retryable_code_when_session_lookup_fails(self, monkeypatch):
        from tracker.websocket.endpoint import SessionLookupError

        async def failing_lookup(session_key):
            raise SessionLookupError()

        monkeypatch.setattr("tracker.websocket.endpoint.get_user_from_session", failing_lookup)

        client = TestClient(application, cookies={"sessionid": "whatever"})
        with client.websocket_connect("/ws?client_id=db-down") as ws:
            msg = ws.receive_json()
            assert msg["event"] == "error"
            assert msg["code"] == "authentication_unavailable"

            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_json()
        # 1011 (internal error) is retryable; 1008 would latch the client's reconnects off.
        assert exc_info.value.code == 1011

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

    @pytest.mark.asyncio
    async def test_tracked_item_updated_reaches_tracking_user(self):
        """A status change on a tracked item is pushed to the tracker's user topic.

        The drawer is not project-scoped, so this event must arrive without any
        project:<key> subscription.
        """
        from tracker.websocket.manager import manager as real_manager

        loop = asyncio.get_running_loop()
        real_manager.set_loop(loop)

        item = await sync_to_async(WorkItem.objects.create)(
            project=self.project,
            key="WSPROJ-301",
            title="Tracked Work Item",
            created_by=self.user,
        )
        await sync_to_async(TrackedItem.objects.create)(user=self.user, work_item=item)
        # Drain the tracked_item.created broadcast scheduled by the row above.
        await asyncio.sleep(0.05)

        mock_ws = AsyncMock()
        await real_manager.connect(mock_ws, client_id="tracker-client", user_id=self.user.id)
        await real_manager.subscribe(mock_ws, f"user:{self.user.id}")
        try:
            mock_ws.send_json.reset_mock()

            await sync_to_async(Progress.objects.create)(
                work_item=item,
                summary="Finished the work",
                proof="sha1",
                status="done",
                created_by=self.user,
            )
            await asyncio.sleep(0.05)

            assert mock_ws.send_json.await_count == 1
            event = mock_ws.send_json.call_args[0][0]
            assert event["event"] == "tracked_item.updated"
            assert event["item_type"] == "work_item"
            assert event["key"] == "WSPROJ-301"
            assert event["status"] == "done"
            assert event["title"] == "Tracked Work Item"
            assert event["project_key"] == "WSPROJ"
        finally:
            await real_manager.disconnect(mock_ws)

    @pytest.mark.asyncio
    async def test_tracked_item_updated_not_sent_to_non_tracking_user(self):
        from tracker.websocket.manager import manager as real_manager

        loop = asyncio.get_running_loop()
        real_manager.set_loop(loop)

        other_user = await sync_to_async(User.objects.create_user)(
            username="otheruser", password="password123"
        )
        item = await sync_to_async(WorkItem.objects.create)(
            project=self.project,
            key="WSPROJ-302",
            title="Tracked By Someone Else",
            created_by=self.user,
        )
        await sync_to_async(TrackedItem.objects.create)(user=self.user, work_item=item)
        await asyncio.sleep(0.05)

        mock_ws = AsyncMock()
        await real_manager.connect(mock_ws, client_id="other-client", user_id=other_user.id)
        await real_manager.subscribe(mock_ws, f"user:{other_user.id}")
        try:
            mock_ws.send_json.reset_mock()

            await sync_to_async(Progress.objects.create)(
                work_item=item,
                summary="Finished the work",
                status="done",
                created_by=self.user,
            )
            await asyncio.sleep(0.05)

            mock_ws.send_json.assert_not_awaited()
        finally:
            await real_manager.disconnect(mock_ws)

    @pytest.mark.asyncio
    async def test_tracked_item_updated_on_progress_delete_recomputes_status(self):
        """Deleting the latest progress row rolls the tracked status back."""
        from tracker.websocket.manager import manager as real_manager

        loop = asyncio.get_running_loop()
        real_manager.set_loop(loop)

        item = await sync_to_async(WorkItem.objects.create)(
            project=self.project,
            key="WSPROJ-303",
            title="Status Rollback",
            created_by=self.user,
        )
        await sync_to_async(TrackedItem.objects.create)(user=self.user, work_item=item)
        await sync_to_async(Progress.objects.create)(
            work_item=item,
            summary="Started",
            status="in progress",
            created_by=self.user,
        )
        done_progress = await sync_to_async(Progress.objects.create)(
            work_item=item,
            summary="Finished",
            status="done",
            created_by=self.user,
        )
        derived_before = await sync_to_async(getattr)(item, "status")
        assert derived_before == "done"
        # Drain the tracked_item.updated pushes from the two progress saves above.
        await asyncio.sleep(0.05)

        mock_ws = AsyncMock()
        await real_manager.connect(mock_ws, client_id="tracker-client-3", user_id=self.user.id)
        await real_manager.subscribe(mock_ws, f"user:{self.user.id}")
        try:
            mock_ws.send_json.reset_mock()

            # post_delete signal -> emit_progress_deleted(..., work_item=item)
            await sync_to_async(done_progress.delete)()
            await asyncio.sleep(0.05)

            assert mock_ws.send_json.await_count == 1
            event = mock_ws.send_json.call_args[0][0]
            assert event["event"] == "tracked_item.updated"
            assert event["item_type"] == "work_item"
            assert event["key"] == "WSPROJ-303"
            assert event["status"] == "in progress"
        finally:
            await real_manager.disconnect(mock_ws)

    @pytest.mark.asyncio
    async def test_progress_deleted_without_work_item_or_trackers_emits_nothing(self):
        """The work_item=None / no-trackers branches are safe no-ops for user topics."""
        from tracker.websocket.events import emit_progress_deleted
        from tracker.websocket.manager import manager as real_manager

        loop = asyncio.get_running_loop()
        real_manager.set_loop(loop)

        item = await sync_to_async(WorkItem.objects.create)(
            project=self.project,
            key="WSPROJ-304",
            title="Nobody Tracks This",
            created_by=self.user,
        )

        mock_ws = AsyncMock()
        await real_manager.connect(mock_ws, client_id="untracked-client", user_id=self.user.id)
        await real_manager.subscribe(mock_ws, f"user:{self.user.id}")
        try:
            mock_ws.send_json.reset_mock()

            # work_item=None: no recomputed status to push, must not raise.
            await sync_to_async(emit_progress_deleted)("WSPROJ", "WSPROJ-304", 4242, work_item=None)
            # work_item present but no TrackedItem rows: empty tracking list, no-op.
            await sync_to_async(emit_progress_deleted)("WSPROJ", item.key, 4243, work_item=item)
            await asyncio.sleep(0.05)

            mock_ws.send_json.assert_not_awaited()
        finally:
            await real_manager.disconnect(mock_ws)

    @pytest.mark.asyncio
    async def test_tracked_item_updated_for_incident_sprint_and_release(self):
        from tracker.websocket.manager import manager as real_manager

        loop = asyncio.get_running_loop()
        real_manager.set_loop(loop)

        incident = await sync_to_async(Incident.objects.create)(
            project=self.project,
            key="WSPROJ-INC-2",
            title="Tracked Incident",
            status="reported",
            created_by=self.user,
        )
        sprint = await sync_to_async(Sprint.objects.create)(
            project=self.project,
            name="Tracked Sprint",
        )
        release = await sync_to_async(Release.objects.create)(
            project=self.project,
            name="Tracked Release",
        )
        await sync_to_async(TrackedItem.objects.create)(user=self.user, incident=incident)
        await sync_to_async(TrackedItem.objects.create)(user=self.user, sprint=sprint)
        await sync_to_async(TrackedItem.objects.create)(user=self.user, release=release)
        await asyncio.sleep(0.05)

        mock_ws = AsyncMock()
        await real_manager.connect(mock_ws, client_id="tracker-client-2", user_id=self.user.id)
        await real_manager.subscribe(mock_ws, f"user:{self.user.id}")
        try:
            # 1. Incident
            mock_ws.send_json.reset_mock()
            incident.status = "done"
            await sync_to_async(incident.save)()
            await asyncio.sleep(0.05)

            assert mock_ws.send_json.await_count == 1
            inc_event = mock_ws.send_json.call_args[0][0]
            assert inc_event["event"] == "tracked_item.updated"
            assert inc_event["item_type"] == "incident"
            assert inc_event["key"] == "WSPROJ-INC-2"
            assert inc_event["status"] == "done"
            assert inc_event["title"] == "Tracked Incident"

            # 2. Sprint
            mock_ws.send_json.reset_mock()
            sprint.status = "done"
            await sync_to_async(sprint.save)()
            await asyncio.sleep(0.05)

            assert mock_ws.send_json.await_count == 1
            sprint_event = mock_ws.send_json.call_args[0][0]
            assert sprint_event["event"] == "tracked_item.updated"
            assert sprint_event["item_type"] == "sprint"
            assert sprint_event["key"] == str(sprint.id)
            assert sprint_event["status"] == "done"
            assert sprint_event["title"] == "Tracked Sprint"

            # 3. Release
            mock_ws.send_json.reset_mock()
            release.status = "in progress"
            await sync_to_async(release.save)()
            await asyncio.sleep(0.05)

            assert mock_ws.send_json.await_count == 1
            release_event = mock_ws.send_json.call_args[0][0]
            assert release_event["event"] == "tracked_item.updated"
            assert release_event["item_type"] == "release"
            assert release_event["key"] == str(release.id)
            assert release_event["status"] == "in progress"
            assert release_event["title"] == "Tracked Release"
        finally:
            await real_manager.disconnect(mock_ws)

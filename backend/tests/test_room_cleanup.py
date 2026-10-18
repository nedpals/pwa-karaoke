import asyncio
import itertools

from session_manager import SessionManager

TTL = 3600
_ids = itertools.count()


class FakeClient:
    """Just enough of ConnectionClient for joining, leaving and broadcasts."""

    def __init__(self, client_type="controller"):
        self.id = f"client-{next(_ids)}"
        self.client_type = client_type
        self.room_id = None
        self.nickname = None
        self.device_id = None

    async def send_command(self, command, data):
        pass

    async def stop_heartbeat(self):
        pass


def connect(sessions, room_id, client_type="controller"):
    client = FakeClient(client_type)
    sessions.client_manager.active_connections.append(client)
    asyncio.run(sessions.join_room(client, room_id))
    return client


def disconnect(sessions, client):
    asyncio.run(sessions.disconnect_client(client))


def test_a_new_room_counts_as_empty():
    sessions = SessionManager()
    room = sessions.room_manager.create_room("fresh")

    assert room.empty_since is not None


def test_an_empty_room_is_kept_until_the_ttl_passes():
    sessions = SessionManager()
    room = sessions.room_manager.create_room("party")

    assert sessions.sweep_idle_rooms(room.empty_since + TTL - 1, TTL) == []
    assert sessions.room_manager.room_exists("party")


def test_an_empty_room_is_removed_once_the_ttl_passes():
    sessions = SessionManager()
    room = sessions.room_manager.create_room("party")

    assert sessions.sweep_idle_rooms(room.empty_since + TTL, TTL) == ["party"]
    assert not sessions.room_manager.room_exists("party")


def test_joining_clears_empty_since():
    sessions = SessionManager()
    room = sessions.room_manager.create_room("party")

    connect(sessions, "party")

    assert room.empty_since is None


def test_a_room_with_a_client_is_kept_even_if_marked_empty_long_ago():
    sessions = SessionManager()
    room = sessions.room_manager.create_room("party")
    connect(sessions, "party")
    room.empty_since = 0

    assert sessions.sweep_idle_rooms(TTL * 10, TTL) == []
    assert sessions.room_manager.room_exists("party")


def test_the_last_client_leaving_marks_the_room_empty():
    sessions = SessionManager()
    room = sessions.room_manager.create_room("party")
    first = connect(sessions, "party")
    second = connect(sessions, "party", "display")

    disconnect(sessions, first)
    assert room.empty_since is None

    disconnect(sessions, second)
    assert room.empty_since is not None


def test_switching_rooms_marks_the_old_room_empty():
    sessions = SessionManager()
    old = sessions.room_manager.create_room("old")
    sessions.room_manager.create_room("new")
    client = connect(sessions, "old")

    asyncio.run(sessions.join_room(client, "new"))

    assert old.empty_since is not None


def test_joining_a_missing_room_leaves_the_client_where_it_was():
    sessions = SessionManager()
    sessions.room_manager.create_room("party")
    client = connect(sessions, "party")

    try:
        asyncio.run(sessions.join_room(client, "gone"))
    except ValueError:
        pass

    assert client.room_id == "party"


def test_sweeping_drops_the_room_leader_entry():
    sessions = SessionManager()
    room = sessions.room_manager.create_room("party")
    display = connect(sessions, "party", "display")
    disconnect(sessions, display)
    assert "party" in sessions.room_leaders

    sessions.sweep_idle_rooms(room.empty_since + TTL, TTL)

    assert "party" not in sessions.room_leaders


def test_only_expired_rooms_are_removed():
    sessions = SessionManager()
    stale = sessions.room_manager.create_room("stale")
    recent = sessions.room_manager.create_room("recent")
    sessions.room_manager.create_room("busy")
    connect(sessions, "busy")
    stale.empty_since = 0
    recent.empty_since = TTL

    assert sessions.sweep_idle_rooms(TTL + 1, TTL) == ["stale"]
    assert sessions.room_manager.room_exists("recent")
    assert sessions.room_manager.room_exists("busy")

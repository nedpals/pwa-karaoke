import asyncio

import pytest

from commands import ControllerCommands
from core.player import DisplayPlayerState
from core.room import RoomManager
from core.search import KaraokeEntry
from room_store import RoomStore
from session_manager import SessionManager
from tests.fakes import FakeClient

SONG = KaraokeEntry(
    id="song-1", title="My Way", artist="Sinatra", source="youtube", uploader="karaoke", duration=270
)
OTHER = KaraokeEntry(
    id="song-2", title="Let It Go", artist="Menzel", source="youtube", uploader="karaoke", duration=225
)


@pytest.fixture
def start_server(tmp_path):
    # Old managers are never shut down, like after a crash
    stores = []

    def start():
        store = RoomStore(tmp_path / "rooms.db")
        stores.append(store)
        manager = RoomManager()
        manager.attach_store(store)
        return manager

    yield start
    for store in stores:
        store.close()


def remote_in(rooms, room_id):
    sessions = SessionManager()
    sessions.room_manager = rooms
    client = FakeClient("controller")
    sessions.client_manager.active_connections.append(client)
    commands = ControllerCommands(client, sessions, service=None)
    asyncio.run(commands.join_room({"room_id": room_id}))
    return commands


def test_room_survives_restart(start_server):
    rooms = start_server()
    room = rooms.create_room("party", password="secret")
    room.add_song(SONG, singer="Ana", singer_device_id="phone-1")
    room.add_song(OTHER)
    room.set_autoplay(False)
    rooms.save_room(room)

    loaded = start_server().get_room("party")

    assert [item.id for item in loaded.queue.items] == [item.id for item in room.queue.items]
    assert loaded.queue.items[0].singer == "Ana"
    assert loaded.autoplay is False
    assert loaded.verify_password("secret")
    assert not loaded.verify_password("wrong")


def test_versions_survive_restart(start_server):
    rooms = start_server()
    room = rooms.create_room("party")
    room.add_song(SONG)
    room.set_autoplay(False)
    rooms.save_room(room)

    loaded = start_server().get_room("party")

    assert loaded.queue_version == room.queue_version
    assert loaded.settings_version == room.settings_version


def test_song_on_air_survives_restart(start_server):
    rooms = start_server()
    room = rooms.create_room("party")
    room.add_song(SONG, singer="Ana", singer_device_id="phone-1")
    on_air = room.play_next()
    rooms.save_room(room)

    loaded = start_server().get_room("party")

    assert loaded.current_singer == "Ana"
    assert loaded.current_singer_device_id == "phone-1"
    assert loaded.player_state is None

    # leader display reports the song it's still playing
    loaded.update_player_state(DisplayPlayerState(
        entry=SONG, play_state="playing", current_time=30, timestamp=0,
    ))
    assert loaded.player_state.item_id == on_air.id


def test_unsaved_changes_are_lost(start_server):
    start_server().create_room("party").add_song(SONG)

    assert start_server().get_room("party").queue.items == []


def test_deleted_room_stays_deleted(start_server):
    rooms = start_server()
    rooms.create_room("party")
    rooms.delete_room("party")

    assert not start_server().room_exists("party")


def test_video_urls_are_cleared_on_load(start_server):
    rooms = start_server()
    room = rooms.create_room("party")
    room.add_song(SONG.model_copy(update={"video_url": "https://video.test/expired"}))
    rooms.save_room(room)

    loaded = start_server().get_room("party")

    assert loaded.queue.items[0].entry.video_url is None


def test_loaded_room_counts_as_empty(start_server):
    rooms = start_server()
    room = rooms.create_room("party")
    room.empty_since = None
    rooms.save_room(room)

    assert start_server().get_room("party").empty_since is not None


def test_bad_row_is_skipped(start_server, tmp_path):
    start_server().create_room("good")
    store = RoomStore(tmp_path / "rooms.db")
    store.connection.execute(
        "INSERT INTO rooms (id, data, updated_at) VALUES ('bad', '{not json', 0)"
    )
    store.connection.commit()
    store.close()

    rooms = start_server()

    assert rooms.room_exists("good")
    assert not rooms.room_exists("bad")


def test_rooms_stay_in_memory_without_a_data_dir():
    first = RoomManager()
    first.attach_store(RoomStore())
    first.create_room("party")

    second = RoomManager()
    second.attach_store(RoomStore())

    assert not second.room_exists("party")


def test_queue_commands_save_the_room(start_server):
    rooms = start_server()
    rooms.create_room("party")
    remote = remote_in(rooms, "party")
    asyncio.run(remote.queue_song(SONG.model_dump()))
    asyncio.run(remote.queue_song(OTHER.model_dump()))
    first, second = [item.id for item in rooms.get_room("party").queue.items]
    asyncio.run(remote.move_song({"item_id": second, "position": 0}))

    assert [item.id for item in start_server().get_room("party").queue.items] == [second, first]

    asyncio.run(remote.remove_song({"entry_id": first}))
    assert [item.id for item in start_server().get_room("party").queue.items] == [second]

    asyncio.run(remote.clear_queue(None))
    assert start_server().get_room("party").queue.items == []


def test_play_next_and_autoplay_commands_save_the_room(start_server):
    rooms = start_server()
    rooms.create_room("party")
    remote = remote_in(rooms, "party")
    asyncio.run(remote.queue_song(SONG.model_dump()))
    on_air = rooms.get_room("party").queue.items[0].id
    asyncio.run(remote.play_next())
    asyncio.run(remote.set_autoplay({"enabled": False}))

    loaded = start_server().get_room("party")

    assert loaded.current_item_id == on_air
    assert loaded.queue.items == []
    assert loaded.autoplay is False

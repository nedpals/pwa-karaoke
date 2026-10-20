import pytest

from core.player import DisplayPlayerState
from core.room import RoomManager
from core.search import KaraokeEntry
from room_store import RoomStore

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


def test_room_survives_restart(start_server):
    room = start_server().create_room("party", password="secret")
    room.add_song(SONG, singer="Ana", singer_device_id="phone-1")
    room.add_song(OTHER)
    room.set_autoplay(False)

    loaded = start_server().get_room("party")

    assert [item.id for item in loaded.queue.items] == [item.id for item in room.queue.items]
    assert loaded.queue.items[0].singer == "Ana"
    assert loaded.autoplay is False
    assert loaded.verify_password("secret")
    assert not loaded.verify_password("wrong")


def test_versions_survive_restart(start_server):
    room = start_server().create_room("party")
    room.add_song(SONG)
    room.set_autoplay(False)

    loaded = start_server().get_room("party")

    assert loaded.queue_version == room.queue_version
    assert loaded.settings_version == room.settings_version


def test_song_on_air_survives_restart(start_server):
    room = start_server().create_room("party")
    room.add_song(SONG, singer="Ana", singer_device_id="phone-1")
    on_air = room.play_next()

    loaded = start_server().get_room("party")

    assert loaded.current_singer == "Ana"
    assert loaded.current_singer_device_id == "phone-1"
    assert loaded.player_state is None

    # leader display reports the song it's still playing
    loaded.update_player_state(DisplayPlayerState(
        entry=SONG, play_state="playing", current_time=30, timestamp=0,
    ))
    assert loaded.player_state.item_id == on_air.id


def test_changes_after_restart_are_saved(start_server):
    start_server().create_room("party")
    start_server().get_room("party").add_song(SONG)

    assert len(start_server().get_room("party").queue.items) == 1


def test_deleted_room_stays_deleted(start_server):
    manager = start_server()
    manager.create_room("party")
    manager.delete_room("party")

    assert not start_server().room_exists("party")


def test_video_urls_are_cleared_on_load(start_server):
    room = start_server().create_room("party")
    room.add_song(SONG.model_copy(update={"video_url": "https://video.test/expired"}))

    loaded = start_server().get_room("party")

    assert loaded.queue.items[0].entry.video_url is None


def test_loaded_room_counts_as_empty(start_server):
    room = start_server().create_room("party")
    room.empty_since = None
    room.add_song(SONG)

    assert start_server().get_room("party").empty_since is not None


def test_bad_row_is_skipped(start_server, tmp_path):
    start_server().create_room("good")
    store = RoomStore(tmp_path / "rooms.db")
    store.connection.execute(
        "INSERT INTO rooms (id, data, updated_at) VALUES ('bad', '{not json', 0)"
    )
    store.connection.commit()
    store.close()

    manager = start_server()

    assert manager.room_exists("good")
    assert not manager.room_exists("bad")

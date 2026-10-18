import asyncio

from commands import ControllerCommands, DisplayCommands
from core.room import Room
from core.search import KaraokeEntry
from session_manager import SessionManager
from tests.fakes import FakeClient


def entry(entry_id="song-1"):
    return KaraokeEntry(
        id=entry_id, title="My Way", artist="Sinatra", source="youtube", uploader="karaoke", duration=270
    )


def room_on_air():
    room = Room(id="party")
    room.add_song(entry())
    item = room.play_next()
    return room, item.id


def test_the_turn_on_air_is_scored_once():
    room, item_id = room_on_air()

    first = room.record_score(item_id, 88, "mic")
    second = room.record_score(item_id, 42, "auto")

    assert first["score"] == 88
    assert second is None
    assert room.score["score"] == 88


def test_a_score_for_another_turn_is_refused():
    room, _ = room_on_air()

    assert room.record_score("some-other-item", 70, "auto") is None
    assert room.score is None


def test_nothing_is_scored_with_no_turn_on_air():
    room = Room(id="party")

    assert room.record_score("item", 70, "auto") is None


def test_the_next_turn_starts_without_a_score():
    room, item_id = room_on_air()
    room.add_song(entry("song-2"))
    room.record_score(item_id, 88, "mic")

    next_item = room.play_next()

    assert room.score is None
    assert room.record_score(next_item.id, 50, "auto")["score"] == 50


def join(sessions, client):
    sessions.client_manager.active_connections.append(client)
    commands_class = DisplayCommands if client.client_type == "display" else ControllerCommands
    commands = commands_class(client, sessions, service=None)
    asyncio.run(commands.join_room({"room_id": "party"}))
    return commands


def scored_room():
    sessions = SessionManager()
    room = sessions.room_manager.create_room("party")
    room.add_song(entry())
    item_id = room.play_next().id
    return sessions, room, item_id


def publish(commands, item_id, score, source="auto"):
    return asyncio.run(commands.publish_score({"item_id": item_id, "score": score, "source": source}))


def test_a_promoted_leader_cannot_publish_a_second_score():
    sessions, room, item_id = scored_room()
    leader_client = FakeClient("display")
    follower_client = FakeClient("display")
    controller = FakeClient("controller")
    leader = join(sessions, leader_client)
    follower = join(sessions, follower_client)
    join(sessions, controller)

    assert publish(leader, item_id, 88, "mic") == {"published": True}
    asyncio.run(sessions.disconnect_client(leader_client))
    assert sessions.is_display_leader(follower_client)

    assert publish(follower, item_id, 42) == {"published": False}
    assert [s["score"] for s in controller.received("score")] == [88]


def test_a_follower_cannot_publish():
    sessions, room, item_id = scored_room()
    join(sessions, FakeClient("display"))
    follower = join(sessions, FakeClient("display"))

    assert publish(follower, item_id, 42) == {"published": False}
    assert room.score is None


def test_a_display_joining_after_the_score_is_sent_it():
    sessions, room, item_id = scored_room()
    leader = join(sessions, FakeClient("display"))
    publish(leader, item_id, 88, "mic")

    late_client = FakeClient("display")
    join(sessions, late_client)

    assert [s["score"] for s in late_client.received("score")] == [88]


def test_no_score_is_sent_on_join_before_the_turn_is_scored():
    sessions, room, item_id = scored_room()
    client = FakeClient("display")

    join(sessions, client)

    assert client.received("score") == []

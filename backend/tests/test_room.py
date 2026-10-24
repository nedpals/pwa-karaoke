import time

from core.player import DisplayPlayerState
from core.room import Room
from core.search import KaraokeEntry

ENTRY = KaraokeEntry(
    id="song-1", title="My Way", artist="Sinatra", source="youtube", uploader="karaoke", duration=270
)


def test_room_records_when_it_was_created():
    before = time.time()
    room = Room(id="fresh")
    after = time.time()

    assert before <= room.created_at <= after


def turn_on_air():
    room = Room(id="party")
    room.add_song(ENTRY)
    room.play_next()
    return room


def report(room, play_state, skipped=False):
    room.update_player_state(DisplayPlayerState(
        entry=ENTRY, play_state=play_state, skipped=skipped, current_time=30, timestamp=0,
    ))
    return room.player_state


def test_a_skip_is_kept_on_the_finished_turn():
    room = turn_on_air()
    report(room, "playing")

    assert report(room, "finished", skipped=True).skipped is True


def test_a_song_that_runs_out_is_not_skipped():
    room = turn_on_air()

    assert report(room, "finished").skipped is False


def test_a_later_finished_report_cannot_rewrite_how_the_turn_ended():
    room = turn_on_air()
    report(room, "finished", skipped=True)

    assert report(room, "finished", skipped=False).skipped is True


def test_a_turn_that_ran_out_cannot_be_relabelled_a_skip():
    room = turn_on_air()
    report(room, "finished")

    assert report(room, "finished", skipped=True).skipped is False


def test_skipped_only_applies_to_a_finished_turn():
    room = turn_on_air()

    assert report(room, "playing", skipped=True).skipped is False


def test_the_next_turn_can_be_skipped_again():
    room = turn_on_air()
    room.add_song(ENTRY)
    report(room, "finished")

    room.play_next()

    assert report(room, "finished", skipped=True).skipped is True


def test_password_hash_is_salted():
    first, second = Room(id="first"), Room(id="second")
    first.set_password("secret")
    second.set_password("secret")

    assert first.password_hash != second.password_hash
    assert "secret" not in first.password_hash
    assert first.verify_password("secret")
    assert second.verify_password("secret")


def test_wrong_or_empty_password_is_rejected():
    room = Room(id="party")
    room.set_password("secret")

    assert not room.verify_password("Secret")
    assert not room.verify_password("")


def test_unreadable_hash_rejects_everything():
    room = Room(id="party", password_hash="not-a-hash")

    assert not room.verify_password("not-a-hash")

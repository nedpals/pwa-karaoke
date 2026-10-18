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

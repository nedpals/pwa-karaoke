import time

from core.room import Room


def test_room_records_when_it_was_created():
    before = time.time()
    room = Room(id="fresh")
    after = time.time()

    assert before <= room.created_at <= after

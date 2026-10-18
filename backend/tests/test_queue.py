from core.queue import KaraokeQueue
from core.search import KaraokeEntry


def make_entry(title: str) -> KaraokeEntry:
    return KaraokeEntry(
        id=title,
        title=title,
        artist="Test Artist",
        source="test",
        uploader="Test Channel",
        duration=180.0,
    )


def make_queue_with_songs(*titles: str) -> KaraokeQueue:
    queue = KaraokeQueue(items=[])
    for title in titles:
        queue.enqueue(make_entry(title))
    return queue


def titles_in(queue: KaraokeQueue) -> list[str]:
    return [item.entry.title for item in queue.items]


def test_new_queue_is_empty():
    queue = KaraokeQueue(items=[])

    assert queue.items == []


def test_enqueue_adds_song_to_the_end():
    queue = make_queue_with_songs("Song A", "Song B")

    assert titles_in(queue) == ["Song A", "Song B"]


def test_enqueue_remembers_the_singer():
    queue = KaraokeQueue(items=[])

    queue.enqueue(make_entry("Song A"), singer="Sam", singer_device_id="device-1")

    assert queue.items[0].singer == "Sam"
    assert queue.items[0].singer_device_id == "device-1"


def test_enqueue_gives_each_item_a_unique_id():
    queue = make_queue_with_songs("Song A", "Song A")

    assert queue.items[0].id != queue.items[1].id


def test_dequeue_removes_the_matching_song():
    queue = make_queue_with_songs("Song A", "Song B", "Song C")
    id_of_b = queue.items[1].id

    queue.dequeue(id_of_b)

    assert titles_in(queue) == ["Song A", "Song C"]


def test_dequeue_returns_the_remaining_items():
    queue = make_queue_with_songs("Song A", "Song B")

    remaining = queue.dequeue(queue.items[0].id)

    assert [item.entry.title for item in remaining] == ["Song B"]


def test_dequeue_with_unknown_id_changes_nothing():
    queue = make_queue_with_songs("Song A", "Song B")

    queue.dequeue("not-a-real-id")

    assert titles_in(queue) == ["Song A", "Song B"]


def test_dequeue_on_empty_queue_does_not_fail():
    queue = KaraokeQueue(items=[])

    queue.dequeue("anything")

    assert queue.items == []


def test_queue_next_moves_song_to_the_front():
    queue = make_queue_with_songs("Song A", "Song B", "Song C")
    id_of_c = queue.items[2].id

    queue.queue_next(id_of_c)

    assert titles_in(queue) == ["Song C", "Song A", "Song B"]


def test_queue_next_with_unknown_id_changes_nothing():
    queue = make_queue_with_songs("Song A", "Song B")

    queue.queue_next("not-a-real-id")

    assert titles_in(queue) == ["Song A", "Song B"]


def test_reorder_moves_songs_to_specified_order():
    queue = make_queue_with_songs("Song A", "Song B", "Song C", "Song D")
    ids = [item.id for item in queue.items]

    # Reorder to C, A, D, B
    changed = queue.reorder([ids[2], ids[0], ids[3], ids[1]])

    assert changed is True
    assert titles_in(queue) == ["Song C", "Song A", "Song D", "Song B"]


def test_reorder_preserves_concurrent_items_not_in_reorder_list():
    queue = make_queue_with_songs("Song A", "Song B", "Song C")
    ids = [item.id for item in queue.items]

    # Reorder only B and A, omitting C
    changed = queue.reorder([ids[1], ids[0]])

    assert changed is True
    assert titles_in(queue) == ["Song B", "Song A", "Song C"]


def test_reorder_same_order_returns_false():
    queue = make_queue_with_songs("Song A", "Song B")
    ids = [item.id for item in queue.items]

    changed = queue.reorder([ids[0], ids[1]])

    assert changed is False
    assert titles_in(queue) == ["Song A", "Song B"]


def test_reorder_with_unknown_ids_ignores_unknowns():
    queue = make_queue_with_songs("Song A", "Song B")
    ids = [item.id for item in queue.items]

    changed = queue.reorder(["unknown-1", ids[1], "unknown-2", ids[0]])

    assert changed is True
    assert titles_in(queue) == ["Song B", "Song A"]

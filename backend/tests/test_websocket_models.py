import pytest

from websocket_models import validate_websocket_message


def make_queue_song_payload() -> dict:
    return {
        "id": "song-1",
        "title": "Song A",
        "artist": "Test Artist",
        "source": "test",
        "uploader": "Test Channel",
        "duration": 180.0,
    }


def test_valid_queue_song_payload_is_returned():
    payload = make_queue_song_payload()

    validated = validate_websocket_message("queue_song", payload)

    assert validated["id"] == "song-1"
    assert validated["title"] == "Song A"
    assert validated["artist"] == "Test Artist"


def test_queue_song_with_empty_title_is_rejected():
    payload = make_queue_song_payload()
    payload["title"] = "  "

    with pytest.raises(ValueError, match="Invalid payload for command 'queue_song'"):
        validate_websocket_message("queue_song", payload)


def test_unknown_command_is_rejected():
    with pytest.raises(ValueError, match="Unknown command: not_a_command"):
        validate_websocket_message("not_a_command", {})


def test_request_id_is_stripped_before_validation():
    payload = make_queue_song_payload()
    payload["request_id"] = "request-1"

    validated = validate_websocket_message("queue_song", payload)

    assert validated["id"] == "song-1"
    assert "request_id" not in validated


def test_reorder_queue_payload_validation():
    validated = validate_websocket_message("reorder_queue", {"item_ids": ["id-1", "id-2"]})
    assert validated["item_ids"] == ["id-1", "id-2"]

    with pytest.raises(ValueError, match="Invalid payload for command 'reorder_queue'"):
        validate_websocket_message("reorder_queue", {"item_ids": []})


def test_move_song_payload_validation():
    validated = validate_websocket_message("move_song", {"item_id": "song-1", "position": 2})
    assert validated["item_id"] == "song-1"
    assert validated["position"] == 2

    with pytest.raises(ValueError, match="Invalid payload for command 'move_song'"):
        validate_websocket_message("move_song", {"item_id": "song-1", "position": -1})


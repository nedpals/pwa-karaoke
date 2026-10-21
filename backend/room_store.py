import sqlite3
import time
from pathlib import Path

from pydantic import ValidationError

from core.room import Room

# player_state and score aren't saved, the leader display sends its state
# again after reconnecting. current_item_id is, so that state still matches
# the song on air.
SAVED_FIELDS = {
    "id",
    "queue",
    "queue_version",
    "autoplay",
    "settings_version",
    "password_hash",
    "created_at",
    "current_item_id",
    "current_singer",
    "current_singer_device_id",
}

class RoomStore:
    def __init__(self, db_path: Path | str = ":memory:"):
        self.db_path = db_path
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(str(db_path), check_same_thread=False)
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA synchronous=NORMAL")
        self.connection.execute("""
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at REAL NOT NULL
            )
        """)
        self.connection.commit()

    def save(self, room: Room):
        try:
            self.connection.execute(
                "INSERT OR REPLACE INTO rooms (id, data, updated_at) VALUES (?, ?, ?)",
                (room.id, room.model_dump_json(include=SAVED_FIELDS), time.time()),
            )
            self.connection.commit()
        except sqlite3.Error as e:
            print(f"[ROOMS] Error saving room {room.id}: {e}")

    def delete(self, room_id: str):
        try:
            self.connection.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
            self.connection.commit()
        except sqlite3.Error as e:
            print(f"[ROOMS] Error deleting room {room_id}: {e}")

    def load_all(self) -> list[Room]:
        rooms = []
        for room_id, data in self.connection.execute("SELECT id, data FROM rooms"):
            try:
                room = Room.model_validate_json(data)
            except ValidationError as e:
                print(f"[ROOMS] Skipping room {room_id}: {e}")
                continue

            # Video URLs expire, let the display fetch new ones
            for item in room.queue.items:
                item.entry.video_url = None
            rooms.append(room)
        return rooms

    def close(self):
        self.connection.close()

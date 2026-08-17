import time
import hashlib
from typing import Optional, Dict, Any

from pydantic import BaseModel, PrivateAttr

from core.search import KaraokeEntry
from core.player import DisplayPlayerState
from core.queue import KaraokeQueue, KaraokeQueueItem
from rate_limit import SlidingWindowLimiter

class Room(BaseModel):
    id: str
    queue: KaraokeQueue = KaraokeQueue(items=[])
    player_state: Optional[DisplayPlayerState] = None
    queue_version: int = 1
    player_version: int = 1
    autoplay: bool = True
    # Held here because a display echoing player state back does not carry it.
    current_singer: Optional[str] = None
    current_singer_device_id: Optional[str] = None
    settings_version: int = 1
    password_hash: Optional[str] = None
    created_at: float = time.time()

    _limiter: SlidingWindowLimiter = PrivateAttr(default_factory=SlidingWindowLimiter)

    def allow_action(self, key: str, limit: int, per_seconds: float) -> bool:
        return self._limiter.allow(key, limit, per_seconds)

    def set_password(self, password: str) -> None:
        if password:
            self.password_hash = hashlib.sha256(password.encode()).hexdigest()
        else:
            self.password_hash = None

    def verify_password(self, password: str) -> bool:
        if not self.password_hash:
            return True

        if not password:
            return False

        password_hash = hashlib.sha256(password.encode()).hexdigest()
        return password_hash == self.password_hash

    def requires_password(self) -> bool:
        return self.password_hash is not None

    def add_song(
        self,
        entry: KaraokeEntry,
        singer: Optional[str] = None,
        singer_device_id: Optional[str] = None,
    ) -> KaraokeQueueItem:
        self.queue.enqueue(entry, singer, singer_device_id)
        self.queue_version += 1
        return self.queue.items[-1]  # Return the newly added item

    def remove_song(self, entry_id: str) -> bool:
        original_length = len(self.queue.items)
        self.queue.dequeue(entry_id)
        if len(self.queue.items) < original_length:
            self.queue_version += 1
            return True
        return False

    def move_to_next(self, entry_id: str) -> bool:
        self.queue.queue_next(entry_id)
        self.queue_version += 1
        return True

    def play_next(self) -> Optional[KaraokeQueueItem]:
        if self.queue.items:
            next_song = self.queue.items.pop(0)
            self.queue_version += 1
            self.current_singer = next_song.singer
            self.current_singer_device_id = next_song.singer_device_id
            return next_song

        self.current_singer = None
        self.current_singer_device_id = None
        return None

    def clear_queue(self) -> None:
        self.queue.items.clear()
        self.queue_version += 1

    def get_current_song(self) -> Optional[KaraokeQueueItem]:
        return self.player_state.entry if self.player_state else None

    def get_up_next_queue(self) -> list[KaraokeQueueItem]:
        return self.queue.items[1:] if len(self.queue.items) > 1 else []

    def set_autoplay(self, enabled: bool) -> bool:
        if self.autoplay == enabled:
            return False

        self.autoplay = enabled
        self.settings_version += 1
        return True

    def update_player_state(self, state: DisplayPlayerState) -> None:
        # Keep versions monotonic. A client clock running ahead of the server would
        # otherwise stamp a version that no later update can beat.
        version = int(time.time() * 1000)
        if self.player_state and version <= self.player_state.version:
            version = self.player_state.version + 1

        state.version = version
        state.timestamp = time.time()
        state.singer = self.current_singer if state.entry else None
        self.player_state = state
        self.player_version += 1

    def get_queue_update_payload(self) -> Dict[str, Any]:
        return {
            "items": [item.model_dump() for item in self.queue.items],
            "version": self.queue_version,
            "timestamp": time.time()
        }

    def get_settings_payload(self) -> Dict[str, Any]:
        return {
            "autoplay": self.autoplay,
            "version": self.settings_version,
            "timestamp": time.time()
        }

    @property
    def is_empty(self) -> bool:
        return len(self.queue.items) == 0

class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    def get_room(self, room_id: str) -> Room:
        if room_id not in self.rooms:
            raise ValueError(f"Room {room_id} does not exist")
        return self.rooms[room_id]

    def create_room(self, room_id: str, password: str = None) -> Room:
        """Create a new room, optionally password protected"""
        if room_id in self.rooms:
            raise ValueError(f"Room {room_id} already exists")

        room = Room(id=room_id)
        if password:
            room.set_password(password)

        self.rooms[room_id] = room
        return room

    def room_exists(self, room_id: str) -> bool:
        """Check if a room exists"""
        return room_id in self.rooms

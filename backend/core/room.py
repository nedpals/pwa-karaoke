import hmac
import os
import time
import hashlib
from typing import TYPE_CHECKING, Callable, Optional, Dict, Any

from pydantic import BaseModel, Field, PrivateAttr

from core.search import KaraokeEntry
from core.player import DisplayPlayerState
from core.queue import KaraokeQueue, KaraokeQueueItem
from rate_limit import SlidingWindowLimiter

if TYPE_CHECKING:
    from room_store import RoomStore

# How much of a song has to have played before it is worth a score. Published
# in room_settings, so the screen and the server enforce the same number.
MIN_SCORED_SECONDS = 5.0

# Hashes end up in rooms.db, so use salted scrypt instead of plain sha256
SCRYPT_PARAMS = {"n": 2**14, "r": 8, "p": 1}

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.scrypt(password.encode(), salt=salt, **SCRYPT_PARAMS)
    return f"{salt.hex()}:{key.hex()}"

def check_password(password: str, stored: str) -> bool:
    try:
        salt, key = stored.split(":")
        attempt = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), **SCRYPT_PARAMS)
    except ValueError:
        return False
    return hmac.compare_digest(attempt.hex(), key)

class Room(BaseModel):
    id: str
    queue: KaraokeQueue = KaraokeQueue(items=[])
    player_state: Optional[DisplayPlayerState] = None
    queue_version: int = 1
    player_version: int = 1
    autoplay: bool = True
    # Held here because a display echoing player state back does not carry it.
    current_item_id: Optional[str] = None
    current_singer: Optional[str] = None
    current_singer_device_id: Optional[str] = None
    # The score the room accepted for the turn on air. One per turn, so a
    # display promoted after the reveal cannot publish a second number.
    score: Optional[Dict[str, Any]] = None
    settings_version: int = 1
    password_hash: Optional[str] = None
    created_at: float = Field(default_factory=time.time)
    # None while someone is connected. A new room counts as empty, so one
    # that is created and never joined is still cleaned up.
    empty_since: Optional[float] = Field(default_factory=time.time)

    _limiter: SlidingWindowLimiter = PrivateAttr(default_factory=SlidingWindowLimiter)
    _on_change: Optional[Callable[["Room"], None]] = PrivateAttr(default=None)

    def set_on_change(self, callback: Optional[Callable[["Room"], None]]) -> None:
        self._on_change = callback

    def _save(self) -> None:
        # Runs before the change is broadcast, so the saved version is never
        # behind what clients have seen
        if self._on_change:
            self._on_change(self)

    def allow_action(self, key: str, limit: int, per_seconds: float) -> bool:
        return self._limiter.allow(key, limit, per_seconds)

    def set_password(self, password: str) -> None:
        if password:
            self.password_hash = hash_password(password)
        else:
            self.password_hash = None

    def verify_password(self, password: str) -> bool:
        if not self.password_hash:
            return True

        if not password:
            return False

        return check_password(password, self.password_hash)

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
        self._save()
        return self.queue.items[-1]  # Return the newly added item

    def remove_song(self, entry_id: str) -> bool:
        original_length = len(self.queue.items)
        self.queue.dequeue(entry_id)
        if len(self.queue.items) < original_length:
            self.queue_version += 1
            self._save()
            return True
        return False

    def move_to_next(self, entry_id: str) -> bool:
        self.queue.queue_next(entry_id)
        self.queue_version += 1
        self._save()
        return True

    def move_song(self, item_id: str, position: int) -> bool:
        changed = self.queue.move_song(item_id, position)
        if changed:
            self.queue_version += 1
            self._save()
        return changed

    def play_next(self) -> Optional[KaraokeQueueItem]:
        self.score = None
        if self.queue.items:
            next_song = self.queue.items.pop(0)
            self.queue_version += 1
            self.current_item_id = next_song.id
            self.current_singer = next_song.singer
            self.current_singer_device_id = next_song.singer_device_id
            self._save()
            return next_song

        self.current_item_id = None
        self.current_singer = None
        self.current_singer_device_id = None
        self._save()
        return None

    def clear_queue(self) -> None:
        self.queue.items.clear()
        self.queue_version += 1
        self._save()

    def record_score(self, item_id: str, score: int, source: str) -> Optional[Dict[str, Any]]:
        """Accept the turn's score, or None if it is not the turn on air or
        already has one."""
        if not self.current_item_id or item_id != self.current_item_id or self.score:
            return None

        self.score = {
            "item_id": item_id,
            "score": score,
            "source": source,
            "timestamp": time.time(),
        }
        return self.score

    def get_current_song(self) -> Optional[KaraokeQueueItem]:
        return self.player_state.entry if self.player_state else None

    def get_up_next_queue(self) -> list[KaraokeQueueItem]:
        return self.queue.items[1:] if len(self.queue.items) > 1 else []

    def set_autoplay(self, enabled: bool) -> bool:
        if self.autoplay == enabled:
            return False

        self.autoplay = enabled
        self.settings_version += 1
        self._save()
        return True

    def update_player_state(self, state: DisplayPlayerState) -> None:
        # Keep versions monotonic. A client clock running ahead of the server would
        # otherwise stamp a version that no later update can beat.
        version = int(time.time() * 1000)
        if self.player_state and version <= self.player_state.version:
            version = self.player_state.version + 1

        state.version = version
        state.timestamp = time.time()
        # Which reservation is on air is the room's to say, so a client echo
        # cannot relabel a performance
        state.item_id = self.current_item_id if state.entry else None
        state.singer = self.current_singer if state.entry else None
        previous = self.player_state
        if state.play_state != "finished":
            state.skipped = False
        elif previous and previous.play_state == "finished" and previous.item_id == state.item_id:
            state.skipped = previous.skipped
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
            "min_scored_seconds": MIN_SCORED_SECONDS,
            "version": self.settings_version,
            "timestamp": time.time()
        }

    @property
    def is_empty(self) -> bool:
        return len(self.queue.items) == 0

class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.store: Optional["RoomStore"] = None

    def attach_store(self, store: "RoomStore") -> int:
        """Load saved rooms and save every change from now on."""
        self.store = store
        loaded = store.load_all()
        for room in loaded:
            room.set_on_change(store.save)
            self.rooms[room.id] = room
        return len(loaded)

    def detach_store(self) -> None:
        for room in self.rooms.values():
            room.set_on_change(None)
        self.store = None

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
        if self.store:
            room.set_on_change(self.store.save)
            self.store.save(room)
        return room

    def delete_room(self, room_id: str) -> None:
        self.rooms.pop(room_id, None)
        if self.store:
            self.store.delete(room_id)

    def room_exists(self, room_id: str) -> bool:
        """Check if a room exists"""
        return room_id in self.rooms

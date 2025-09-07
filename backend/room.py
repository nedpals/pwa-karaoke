import time
from typing import Optional, Dict, Any

from pydantic import BaseModel

from core.search import KaraokeEntry
from core.player import DisplayPlayerState
from core.queue import KaraokeQueue, KaraokeQueueItem

class Room(BaseModel):
    id: str
    queue: KaraokeQueue = KaraokeQueue(items=[])
    player_state: Optional[DisplayPlayerState] = None
    queue_version: int = 1
    player_version: int = 1
    
    def add_song(self, entry: KaraokeEntry) -> KaraokeQueueItem:
        self.queue.enqueue(entry)
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
            self.queue.items.pop(0)
            self.queue_version += 1
            return self.queue.items[0] if self.queue.items else None
        return None
    
    def clear_queue(self) -> None:
        self.queue.items.clear()
        self.queue_version += 1
    
    def get_current_song(self) -> Optional[KaraokeQueueItem]:
        return self.queue.items[0] if self.queue.items else None
    
    def get_up_next_queue(self) -> list[KaraokeQueueItem]:
        return self.queue.items[1:] if len(self.queue.items) > 1 else []
    
    def update_player_state(self, state: DisplayPlayerState) -> None:
        state.version = int(time.time() * 1000)
        state.timestamp = time.time()
        self.player_state = state
        self.player_version += 1
    
    def get_queue_update_payload(self) -> Dict[str, Any]:
        return {
            "items": [item.model_dump() for item in self.queue.items],
            "version": self.queue_version,
            "timestamp": time.time()
        }
    
    def get_up_next_payload(self) -> Dict[str, Any]:
        up_next = self.get_up_next_queue()
        return {
            "items": [item.model_dump() for item in up_next],
            "version": self.queue_version,
            "timestamp": time.time()
        }

class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self._ensure_default_room()
    
    def _ensure_default_room(self) -> None:
        if "default" not in self.rooms:
            self.rooms["default"] = Room(id="default")
    
    def get_room(self, room_id: str = "default") -> Room:
        if room_id not in self.rooms:
            self.rooms[room_id] = Room(id=room_id)
        return self.rooms[room_id]
    

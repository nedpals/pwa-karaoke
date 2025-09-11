import time
import hashlib
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
    is_public: bool = True
    password_hash: Optional[str] = None
    created_at: float = time.time()
    
    def set_password(self, password: str) -> None:
        if password:
            self.password_hash = hashlib.sha256(password.encode()).hexdigest()
            self.is_public = False
        else:
            self.password_hash = None
            self.is_public = True
    
    def verify_password(self, password: str) -> bool:
        if not self.password_hash:
            return True
        
        if not password:
            return False
            
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        return password_hash == self.password_hash
    
    def requires_password(self) -> bool:
        return self.password_hash is not None
    
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
    
    def get_room(self, room_id: str) -> Room:
        if room_id not in self.rooms:
            self.rooms[room_id] = Room(id=room_id)
        return self.rooms[room_id]
    
    def create_room(self, room_id: str, is_public: bool = True, password: str = None) -> Room:
        """Create a new room with privacy settings"""
        if room_id in self.rooms:
            raise ValueError(f"Room {room_id} already exists")
        
        room = Room(id=room_id, is_public=is_public)
        if password:
            room.set_password(password)
        
        self.rooms[room_id] = room
        return room
    
    def get_public_rooms(self) -> Dict[str, Room]:
        """Get only public rooms"""
        return {room_id: room for room_id, room in self.rooms.items() if room.is_public}
    
    def room_exists(self, room_id: str) -> bool:
        """Check if a room exists"""
        return room_id in self.rooms
    

from typing import Optional

from core.search import KaraokeEntry
from pydantic import BaseModel, Field

from nanoid import generate as generate_nanoid

class KaraokeQueueItem(BaseModel):
    entry: KaraokeEntry
    id: str = Field(default_factory=generate_nanoid)
    singer: Optional[str] = None
    singer_device_id: Optional[str] = None

class KaraokeQueue(BaseModel):
    items: list[KaraokeQueueItem]

    def enqueue(
        self,
        entry: KaraokeEntry,
        singer: Optional[str] = None,
        singer_device_id: Optional[str] = None,
    ):
        self.items.append(
            KaraokeQueueItem(entry=entry, singer=singer, singer_device_id=singer_device_id)
        )

    def dequeue(self, id_to_delete: str):
        for queue_item in self.items:
            if queue_item.id == id_to_delete:
                self.items.remove(queue_item)
                break

        return self.items

    def queue_next(self, id_to_queue_next: str):
        # Move the item with the given ID to the front of the queue
        for index, queue_item in enumerate(self.items):
            if queue_item.id == id_to_queue_next:
                item = self.items.pop(index)
                self.items.insert(0, item)
                break

    def move_song(self, item_id: str, position: int) -> bool:
        """Move an item to a specific position (0-indexed).

        Returns True if the item was moved to a new position, False otherwise.
        """
        if not self.items:
            return False

        target_index = max(0, min(position, len(self.items) - 1))
        for index, queue_item in enumerate(self.items):
            if queue_item.id == item_id:
                if index == target_index:
                    return False
                item = self.items.pop(index)
                self.items.insert(target_index, item)
                return True
        return False

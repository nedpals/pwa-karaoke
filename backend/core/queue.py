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

    def reorder(self, item_ids: list[str]) -> bool:
        """Reorder items to match the order in item_ids.

        Any existing items not in item_ids are preserved at the end of the queue.
        Returns True if the order changed, False otherwise.
        """
        id_to_item = {item.id: item for item in self.items}
        new_items = []
        for item_id in item_ids:
            if item_id in id_to_item:
                new_items.append(id_to_item.pop(item_id))
        # Keep any items that were added concurrently and not in item_ids
        new_items.extend(id_to_item.values())

        if [item.id for item in self.items] == [item.id for item in new_items]:
            return False

        self.items = new_items
        return True

from search import KaraokeEntry
from pydantic import BaseModel, Field

from nanoid import generate as generate_nanoid

class KaraokeQueueItem(BaseModel):
    entry: KaraokeEntry
    id: str = Field(default_factory=generate_nanoid)

class KaraokeQueue(BaseModel):
    items: list[KaraokeQueueItem]

    def enqueue(self, entry: KaraokeEntry):
        self.items.append(KaraokeQueueItem(entry=entry))

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

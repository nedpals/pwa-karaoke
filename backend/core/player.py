from typing_extensions import Literal
from pydantic import BaseModel, Field
from core.search import KaraokeEntry


class DisplayPlayerState(BaseModel):
    """Player state model for karaoke display and control"""
    entry: KaraokeEntry | None
    # The reservation, not the song: the same track queued twice is two turns
    # with two singers. Stamped by the room, never taken from a client.
    item_id: str | None = None
    singer: str | None = None
    # "finished" keeps the song on the screen; "idle" is an empty room.
    play_state: Literal["playing", "paused", "finished", "buffering", "error", "idle"]
    current_time: float = Field(0.0, ge=0.0)
    duration: float = Field(0.0, ge=0.0) 
    volume: float = Field(1.0, ge=0.0, le=1.0)
    version: int = Field(1, ge=1)
    timestamp: float
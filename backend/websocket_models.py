from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, Field, validator
from core.search import KaraokeEntry
from core.player import DisplayPlayerState

class WebSocketMessage(BaseModel):
    """Base WebSocket message structure"""
    command: str
    payload: Optional[Dict[str, Any]] = None

class HandshakePayload(BaseModel):
    """Handshake message payload"""
    client_type: Literal["controller", "display"]

class PingPongPayload(BaseModel):
    """Payload for ping/pong messages with timestamp"""
    timestamp: float

class QueueSongPayload(KaraokeEntry):
    """Queue song command payload - inherits from KaraokeEntry with validation"""
    
    @validator('title', 'artist')
    def validate_strings(cls, v):
        if not v or not v.strip():
            raise ValueError('Title and artist cannot be empty')
        return v.strip()

class EntryIDPayload(BaseModel):
    """Payload with entry_id field"""
    entry_id: str = Field(..., min_length=1)

class SetVolumePayload(BaseModel):
    """Set volume command payload"""
    volume: float = Field(..., ge=0.0, le=1.0)

class PlayerStatePayload(DisplayPlayerState):
    """Player state update payload - inherits from DisplayPlayerState"""
    pass

class QueueUpdatePayload(BaseModel):
    """Queue update payload"""
    items: list = Field(default_factory=list)
    version: int = Field(..., ge=1)
    timestamp: float

class AckPayload(BaseModel):
    """Acknowledgment payload"""
    request_id: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None

# Mapping of commands to their expected payload types
COMMAND_PAYLOAD_MAP = {
    "handshake": HandshakePayload,
    "ping": PingPongPayload,
    "pong": PingPongPayload,
    "request_full_state": dict,
    "queue_song": QueueSongPayload,
    "remove_song": EntryIDPayload,
    "queue_next_song": EntryIDPayload,
    "set_volume": SetVolumePayload,
    "player_state": PlayerStatePayload,
    "update_player_state": PlayerStatePayload,
    "queue_update": QueueUpdatePayload,
    "video_loaded": PlayerStatePayload,
    "ack": AckPayload,
    # Commands without payload validation
    "play_song": dict,
    "pause_song": dict,
    "play_next": dict,
    "clear_queue": dict,
    "request_queue_update": dict,
    "send_current_queue": dict,
    "send_full_state": dict,
}

def validate_websocket_message(command: str, payload: Any) -> Dict[str, Any]:
    """Validate WebSocket message payload against expected schema"""
    if command not in COMMAND_PAYLOAD_MAP:
        raise ValueError(f"Unknown command: {command}")
    
    payload_type = COMMAND_PAYLOAD_MAP[command]
    
    # Skip validation for basic dict commands
    if payload_type == dict:
        return payload if isinstance(payload, dict) else {}
    
    # Validate using Pydantic model
    try:
        if payload is None:
            # For commands that don't require payload
            validated = payload_type()
        else:
            validated = payload_type.parse_obj(payload)
        return validated.dict()
    except Exception as e:
        raise ValueError(f"Invalid payload for command '{command}': {str(e)}")
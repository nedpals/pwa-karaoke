from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel

class WebSocketErrorType(str, Enum):
    """Enumeration of WebSocket error types for better error handling"""
    HANDSHAKE_FAILED = "handshake_failed"
    INVALID_COMMAND = "invalid_command" 
    COMMAND_EXECUTION_FAILED = "command_execution_failed"
    CONNECTION_LOST = "connection_lost"
    HEARTBEAT_TIMEOUT = "heartbeat_timeout"
    VALIDATION_ERROR = "validation_error"
    AUTHORIZATION_ERROR = "authorization_error"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    QUEUE_CONFLICT = "queue_conflict"
    STATE_SYNC_ERROR = "state_sync_error"

class WebSocketError(BaseModel):
    """Structured WebSocket error with type, message, and optional details"""
    error_type: WebSocketErrorType
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: float
    request_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for sending over WebSocket"""
        return {
            "error_type": self.error_type.value,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp,
            "request_id": self.request_id
        }

class WebSocketException(Exception):
    """Custom exception for WebSocket operations with structured error info"""
    
    def __init__(self, error_type: WebSocketErrorType, message: str, 
                 details: Optional[Dict[str, Any]] = None, request_id: Optional[str] = None):
        self.error_type = error_type
        self.message = message
        self.details = details
        self.request_id = request_id
        super().__init__(message)

    def to_error(self, timestamp: float) -> WebSocketError:
        """Convert exception to WebSocketError"""
        return WebSocketError(
            error_type=self.error_type,
            message=self.message,
            details=self.details,
            timestamp=timestamp,
            request_id=self.request_id
        )

def create_error_response(error_type: WebSocketErrorType, message: str, 
                         details: Optional[Dict[str, Any]] = None, 
                         request_id: Optional[str] = None) -> Dict[str, Any]:
    """Helper function to create standardized error responses"""
    import time
    
    error = WebSocketError(
        error_type=error_type,
        message=message,
        details=details,
        timestamp=time.time(),
        request_id=request_id
    )
    return error.to_dict()
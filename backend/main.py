from typing_extensions import Annotated
from pathlib import Path
from os import environ
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.websockets import WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from core.room import Room
from core.search import KaraokeEntry
from services.karaoke_service import KaraokeService, KaraokeSearchResult, VideoURLResponse
from commands import ControllerCommands, DisplayCommands
from websocket_errors import WebSocketErrorType, create_error_response
from websocket_models import validate_websocket_message
from session_manager import SessionManager
from cache_store import get_cache_store, set_cache_store, clear_cache_store, CacheStore

# Request/Response models
class CreateRoomRequest(BaseModel):
    room_id: str
    is_public: bool = True
    password: str = None

class PublicRoomResponse(BaseModel):
    id: str
    is_public: bool
    requires_password: bool
    created_at: float

    @staticmethod
    def from_room(room: Room) -> "PublicRoomResponse":
        return PublicRoomResponse(
            id=room.id,
            is_public=room.is_public,
            requires_password=room.requires_password(),
            created_at=room.created_at
        )

class RoomFoundResponse(BaseModel):
    success: bool
    room: PublicRoomResponse

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[STARTUP] Karaoke server starting up...")
    cache = CacheStore()
    set_cache_store(cache)
    print(f"[STARTUP] Cache initialized: {cache.get_stats()}")

    yield

    # Shutdown
    print("[SHUTDOWN] Karaoke server shutting down...")
    cache = get_cache_store()
    cache.cleanup()
    clear_cache_store()
    print("[SHUTDOWN] Cleanup completed")

app = FastAPI(lifespan=lifespan)

# Add CORS middleware with proper security
allowed_origins = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:8000",  # Self-hosting
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
]

# Add domain from environment if specified (matches Caddy service)
domain = environ.get("DOMAIN")
if domain and domain != "localhost":
    print(f"[CORS] Added domain: {domain}")
    allowed_origins.extend([
        f"https://{domain}",
        f"http://{domain}"
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

session_manager = SessionManager()
security = HTTPBasic()

# Dependencies
def get_cache() -> CacheStore:
    return get_cache_store()

def get_current_room(credentials: HTTPBasicCredentials = Depends(security)) -> Room:
    room_id = credentials.username
    password = credentials.password

    if not session_manager.room_manager.room_exists(room_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Room not found",
            headers={"WWW-Authenticate": "Basic"},
        )

    try:
        room = session_manager.room_manager.get_room(room_id)
        if room.requires_password():
            if not password or not room.verify_password(password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid room password",
                    headers={"WWW-Authenticate": "Basic"},
                )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
            headers={"WWW-Authenticate": "Basic"},
        )

    return room

@app.get("/search")
async def search(
    query: str,
    service: Annotated[KaraokeService, Depends()],
    _: Annotated[str, Depends(get_current_room)]
) -> KaraokeSearchResult:
    return await service.search(query)

@app.post("/get_video_url")
async def get_video_url(
    entry: KaraokeEntry,
    service: Annotated[KaraokeService, Depends()],
    _: Annotated[str, Depends(get_current_room)]
) -> VideoURLResponse:
    return await service.get_video_url(entry)

@app.get("/health")
async def get_health(cache: Annotated[CacheStore, Depends(get_cache)]):
    """Get WebSocket connection health metrics"""
    health_metrics = session_manager.get_health_metrics()
    cache_stats = cache.get_stats()

    return {
        **health_metrics,
        "cache": cache_stats
    }

@app.get("/heartbeat")
async def heartbeat():
    """Simple heartbeat endpoint for frontend server status monitoring"""
    return {
        "status": "ok",
        "timestamp": int(time.time() * 1000)  # milliseconds timestamp
    }

@app.get("/rooms")
async def get_active_rooms():
    return {
        "rooms": session_manager.get_active_rooms(),
        "timestamp": time.time()
    }

@app.post("/rooms/create")
async def create_room(request: CreateRoomRequest):
    try:
        room = session_manager.room_manager.create_room(
            room_id=request.room_id,
            is_public=request.is_public,
            password=request.password
        )
        return RoomFoundResponse(
            success=True,
            room=PublicRoomResponse.from_room(room)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/rooms/{room_id}")
async def get_room_details(room_id: str):
    try:
        room = session_manager.room_manager.get_room(room_id)
        return PublicRoomResponse.from_room(room)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
            headers={"WWW-Authenticate": "Basic"},
        )

@app.post("/rooms/verify")
async def verify_room_access(room: Annotated[Room, Depends(get_current_room)]):
    return RoomFoundResponse(
        success=True,
        room=PublicRoomResponse.from_room(room)
    )

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, service: Annotated[KaraokeService, Depends()]):
    client = await session_manager.connect_client(websocket)
    if not client:
        # Manager already disconnected the websocket
        return

    try:
        commands = ControllerCommands(client, session_manager, service)
        if client.client_type == "display":
            commands = DisplayCommands(client, session_manager, service)

        while True:
            command, payload = await client.receive()
            print(f"[DEBUG] Received command from {client.client_type}: {command}")

            # Extract request_id if present for acknowledgment
            request_id = None
            if isinstance(payload, dict) and "request_id" in payload:
                request_id = payload.pop("request_id")

            # Validate message payload
            try:
                validated_payload = validate_websocket_message(command, payload)
            except ValueError as e:
                print(f"[DEBUG] Payload validation failed for {command}: {e}")
                error_response = create_error_response(
                    WebSocketErrorType.VALIDATION_ERROR,
                    f"Invalid message format: {str(e)}",
                    details={"command": command, "validation_error": str(e)},
                    request_id=request_id
                )

                if request_id:
                    await client.send_command("ack", {"request_id": request_id, "success": False, "error": error_response})
                else:
                    await client.send_command("error", error_response)
                continue

            if command.startswith("_") or not hasattr(commands, command):
                print(f"[DEBUG] Unknown command: {command} for {client.client_type}")
                error_response = create_error_response(
                    WebSocketErrorType.INVALID_COMMAND,
                    f"Unknown command: {command}",
                    details={"command": command, "client_type": client.client_type},
                    request_id=request_id
                )

                if request_id:
                    await client.send_command("ack", {"request_id": request_id, "success": False, "error": error_response})
                else:
                    await client.send_command("error", error_response)
                continue

            # See commands.py for command implementations
            print(f"[DEBUG] Executing command: {client.client_type}.{command}")
            try:
                result = await getattr(commands, command)(validated_payload)

                # Send acknowledgment if request_id was provided
                if request_id:
                    await client.send_command("ack", {"request_id": request_id, "success": True, "result": result})

            except Exception as e:
                print(f"[ERROR] Command {command} failed: {e}")
                error_response = create_error_response(
                    WebSocketErrorType.COMMAND_EXECUTION_FAILED,
                    f"Command execution failed: {str(e)}",
                    details={"command": command, "client_type": client.client_type, "error": str(e)},
                    request_id=request_id
                )

                if request_id:
                    await client.send_command("ack", {"request_id": request_id, "success": False, "error": error_response})
                else:
                    await client.send_command("error", error_response)

                # Continue processing other commands instead of disconnecting
                continue
    except (WebSocketDisconnect, Exception) as e:
        print(f"[ERROR] {e}")
        # Handle all disconnection scenarios
        await session_manager.disconnect_client(client)

# Serve other static files
static_dir = Path(__file__).parent / "static"
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(environ.get("PORT", "8000")))

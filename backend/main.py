from typing_extensions import Annotated
from pathlib import Path
from os import environ
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, Request, Response, WebSocket, Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.websockets import WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from core.room import Room
from core.search import KaraokeEntry
from services.karaoke_service import (
    KaraokeService,
    KaraokeSearchResult,
    VideoURLResponse,
    DEFAULT_SEARCH_LIMIT,
    MAX_SEARCH_LIMIT,
    SOURCE_REGISTRY,
)
from commands import ControllerCommands, DisplayCommands
from websocket_errors import WebSocketErrorType, create_error_response
from websocket_models import validate_websocket_message, QUIET_COMMANDS
from session_manager import SessionManager
from cache_store import get_cache_store, set_cache_store, clear_cache_store, CacheStore
from media_archive import (
    MEDIA_URL_PREFIX,
    PendingMedia,
    close_media_archive,
    get_media_archive,
    get_media_archiver,
    init_media_archive,
)
from fastapi.responses import StreamingResponse

# Request/Response models
class CreateRoomRequest(BaseModel):
    room_id: str
    password: str = None

class PublicRoomResponse(BaseModel):
    id: str
    requires_password: bool
    created_at: float

    @staticmethod
    def from_room(room: Room) -> "PublicRoomResponse":
        return PublicRoomResponse(
            id=room.id,
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

    archive = init_media_archive()
    if archive.enabled:
        print(f"[STARTUP] Media archive: {archive.stats()}")
    else:
        print("[STARTUP] Media archive disabled")

    print(f"[STARTUP] Sources enabled: {', '.join(SOURCE_REGISTRY.ids)}")
    sources = await KaraokeService().get_health()
    for provider_id, state in sources["providers"].items():
        if state["available"]:
            print(f"[STARTUP] Source ready: {provider_id} {state.get('version') or ''}".rstrip())
        else:
            print(f"[STARTUP] Source unavailable: {provider_id}: {state.get('last_error')}")

    yield

    # Shutdown
    print("[SHUTDOWN] Karaoke server shutting down...")
    await close_media_archive()
    await SOURCE_REGISTRY.close()
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

static_dir = Path(__file__).parent / "static"
static_root = static_dir.resolve()
assets_root = (static_dir / "assets").resolve()

NO_CACHE = {"Cache-Control": "no-cache"}
IMMUTABLE = {"Cache-Control": "public, max-age=31536000, immutable"}
ALWAYS_REVALIDATE = {"index.html", "sw.js", "registerSW.js", "manifest.webmanifest"}

def resolve_static_file(url_path: str) -> Path | None:
    """Map a URL path to a file inside static_dir, or None if it misses/escapes."""
    candidate = (static_dir / url_path.lstrip("/")).resolve()
    if candidate != static_root and static_root not in candidate.parents:
        return None
    return candidate if candidate.is_file() else None

def static_file_response(path: Path) -> FileResponse:
    if path.name in ALWAYS_REVALIDATE:
        return FileResponse(path, headers=NO_CACHE)
    # Vite content-hashes everything under assets/, so a rebuild changes the name.
    if path.parent == assets_root:
        return FileResponse(path, headers=IMMUTABLE)
    return FileResponse(path)

def spa_index_response() -> FileResponse:
    index_file = static_dir / "index.html"
    if not index_file.is_file():
        raise HTTPException(status_code=404, detail="Application not found")
    return FileResponse(index_file, headers=NO_CACHE)

@app.get("/")
async def serve_spa_index():
    return spa_index_response()

@app.get("/search")
async def search(
    query: str,
    service: Annotated[KaraokeService, Depends()],
    _: Annotated[str, Depends(get_current_room)],
    limit: int = Query(DEFAULT_SEARCH_LIMIT, ge=1, le=MAX_SEARCH_LIMIT),
    offset: int = Query(0, ge=0),
) -> KaraokeSearchResult:
    return await service.search(query, limit=limit, offset=offset)

@app.post("/get_video_url")
async def get_video_url(
    entry: KaraokeEntry,
    service: Annotated[KaraokeService, Depends()],
    _: Annotated[str, Depends(get_current_room)]
) -> VideoURLResponse:
    return await service.get_video_url(entry)

@app.get("/health")
async def get_health(
    cache: Annotated[CacheStore, Depends(get_cache)],
    service: Annotated[KaraokeService, Depends()],
    response: Response
):
    """Get WebSocket connection health metrics"""
    health_metrics = session_manager.get_health_metrics()
    cache_stats = cache.get_stats()

    # Reports unhealthy once no source can resolve a video, so the container
    # healthcheck catches it rather than leaving songs to queue and stall.
    # Providers re-probe here, which is what lets one recover without a restart.
    sources = await service.get_health()
    if not sources["available"]:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        **health_metrics,
        "cache": cache_stats,
        "archive": get_media_archive().stats(),
        "sources": sources
    }

@app.get("/heartbeat")
async def heartbeat():
    """Simple heartbeat endpoint for frontend server status monitoring"""
    return {
        "status": "ok",
        "timestamp": int(time.time() * 1000)  # milliseconds timestamp
    }

@app.post("/rooms/create")
async def create_room(request: CreateRoomRequest):
    try:
        room = session_manager.room_manager.create_room(
            room_id=request.room_id,
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
            verbose = command not in QUIET_COMMANDS
            if verbose:
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
            if verbose:
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

def parse_byte_range(header: str | None, size: int) -> tuple[int, int] | None:
    """
    The single byte range a request asks for, or None for the whole file.

    Only one range is honoured. A <video> element asks for one at a time, and a
    multipart answer would need a different body format for no gain here.
    """
    if not header or not header.startswith("bytes="):
        return None

    first = header[len("bytes="):].split(",")[0].strip()
    start_text, _, end_text = first.partition("-")

    try:
        if not start_text:
            # A suffix range: the last N bytes.
            length = int(end_text)
            if length <= 0:
                return None
            return max(0, size - length), size - 1

        start = int(start_text)
        end = int(end_text) if end_text else size - 1
    except ValueError:
        return None

    end = min(end, size - 1)
    if start > end or start >= size:
        return None

    return start, end


def stream_pending_media(pending: PendingMedia, request: Request) -> StreamingResponse:
    """
    Serve a copy that is still downloading.

    This is what keeps a song from waiting on its whole file: the display starts
    playing while the rest arrives. The size is known up front, so ranges and
    seeking work exactly as they do for a finished file; the only difference is
    that a read may have to wait for the writer to catch up.
    """
    size = pending.total_bytes
    span = parse_byte_range(request.headers.get("range"), size)

    headers = {
        "Cache-Control": "no-store",  # Incomplete: nothing may keep a copy of this
        "Accept-Ranges": "bytes",
    }

    if span is None:
        start, end, status_code = 0, size - 1, 200
    else:
        start, end = span
        status_code = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"

    headers["Content-Length"] = str(end - start + 1)

    return StreamingResponse(
        pending.read_range(start, end),
        status_code=status_code,
        media_type=pending.content_type,
        headers=headers,
    )


@app.get(MEDIA_URL_PREFIX + "/{key:path}")
async def serve_archived_media(
    key: str,
    request: Request,
    expires: int = Query(...),
    signature: str = Query(...),
):
    """
    Serve an archived video against a signed URL.

    Unauthenticated, like the source URLs it replaces, because a <video> element
    sends no credentials. The signature is what stands in for them: without one
    the archive would be an open media host addressed by video ID. Everything a
    request may not have looks the same from outside, hence one 404 for a bad
    signature, an expired URL and a missing file alike.
    """
    archive = get_media_archive()
    if not archive.verify_signature(key, expires, signature):
        raise HTTPException(status_code=404, detail="Not found")

    path = archive.path_for(key)
    if path is not None and path.is_file():
        # Private: the URL is per request and dies with its signature, so a
        # shared cache holding it would outlive the permission to serve it.
        return FileResponse(path, headers={"Cache-Control": "private, max-age=3600"})

    archiver = get_media_archiver()
    pending = archiver.pending_for_media(key) if archiver else None
    if pending is not None and pending.streamable:
        return stream_pending_media(pending, request)

    raise HTTPException(status_code=404, detail="Not found")

# Static files + SPA fallback, must stay after all API routes
@app.get("/{full_path:path}")
async def serve_spa(full_path: str, request: Request):
    """Serve a built asset if one exists, otherwise the SPA shell for client routes."""
    static_file = resolve_static_file(full_path)
    if static_file is not None:
        return static_file_response(static_file)

    # Only navigations get the shell. Answering asset requests with it would make
    # a stale hashed asset return HTML with a 200, which the service worker then
    # precaches under a .js URL.
    if "text/html" in request.headers.get("accept", ""):
        return spa_index_response()

    raise HTTPException(status_code=404, detail="Not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(environ.get("PORT", "8000")))

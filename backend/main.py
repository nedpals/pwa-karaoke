from typing_extensions import Annotated
from pathlib import Path
from os import environ

from fastapi import FastAPI, WebSocket, Depends, HTTPException
from fastapi.websockets import WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.search import KaraokeEntry
from services.karaoke_service import KaraokeService, KaraokeSearchResult, VideoURLResponse
from commands import ControllerCommands, DisplayCommands
from websocket_errors import WebSocketErrorType, create_error_response
from websocket_models import validate_websocket_message
from session_manager import SessionManager

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for production hosting
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

session_manager = SessionManager()

# Mount static files from frontend build
static_dir = Path(__file__).parent / "static"
app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

@app.get("/search")
async def search(query: str, service: Annotated[KaraokeService, Depends()]) -> KaraokeSearchResult:
    return await service.search(query)

@app.post("/get_video_url")
async def get_video_url(entry: KaraokeEntry, service: Annotated[KaraokeService, Depends()]) -> VideoURLResponse:
    return await service.get_video_url(entry)

@app.get("/health")
async def get_health():
    """Get WebSocket connection health metrics"""
    return session_manager.get_health_metrics()

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
@app.get("/vite.svg")
async def vite_svg():
    return FileResponse(static_dir / "vite.svg")

# Serve the main HTML for all frontend routes (must be last!)
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # Serve index.html for all frontend routes (SPA routing)
    return FileResponse(static_dir / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(environ.get("PORT", "8000")))

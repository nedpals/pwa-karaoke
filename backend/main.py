from typing_extensions import Annotated

from fastapi import FastAPI, WebSocket, Depends
from fastapi.websockets import WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from core.search import KaraokeEntry
from services.karaoke_service import KaraokeService, KaraokeSearchResult, VideoURLResponse
from client_manager import ClientManager
from commands import ControllerCommands, DisplayCommands

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ClientManager()

@app.get("/search")
async def search(query: str, service: Annotated[KaraokeService, Depends()]) -> KaraokeSearchResult:
    return await service.search(query)

@app.post("/get_video_url")
async def get_video_url(entry: KaraokeEntry, service: Annotated[KaraokeService, Depends()]) -> VideoURLResponse:
    return await service.get_video_url(entry)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, service: Annotated[KaraokeService, Depends()]):
    client = await manager.connect(websocket)
    if not client:
        # Manager already disconnected the websocket
        return

    try:
        commands = ControllerCommands(client, manager, service)
        if client.client_type == "display":
            commands = DisplayCommands(client, manager, service)

        while True:
            command, payload = await client.receive()
            print(f"[DEBUG] Received command from {client.client_type}: {command}")
            if command.startswith("_") or not hasattr(commands, command):
                print(f"[DEBUG] Unknown command: {command} for {client.client_type}")
                await client.send_command("error", f"Unknown command (for '{client.client_type}'): {command}")
                continue

            # See commands.py for command implementations
            print(f"[DEBUG] Executing command: {client.client_type}.{command}")
            await getattr(commands, command)(payload)
    except (WebSocketDisconnect, Exception) as e:
        print(f"[ERROR] {e}")
        # Handle all disconnection scenarios
        await manager.disconnect(client)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

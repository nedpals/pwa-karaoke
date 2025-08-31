from typing import Literal
from fastapi import WebSocket, WebSocketDisconnect

class ConnectionClient:
    websocket: WebSocket
    client_type: Literal["controller", "display"]

    async def send_command(self, command: str, data):
        await self.websocket.send_json([command, data])

    async def receive(self) -> tuple[str, any]:
        data = await self.websocket.receive_json()
        if not isinstance(data, list):
            raise Exception("Invalid message format")
        return data[0], data[1]

class ClientManager:
    def __init__(self):
        self.active_connections: list[ConnectionClient] = []
        self.has_display_client = False

    async def connect(self, websocket: WebSocket):
        try:
            await websocket.accept()
            client = await self.handshake(websocket)
            self.active_connections.append(client)
            await self.broadcast_client_count()
            return client
        except WebSocketDisconnect:
            # TODO: better error message
            await websocket.send_json(["error", "Invalid handshake"])
            await websocket.close()

    async def handshake(self, websocket: WebSocket) -> ConnectionClient:
        data = await websocket.receive_json()
        if not isinstance(data, list) and data[0] != "handshake":
            raise WebSocketDisconnect()

        client_type = data[1]
        if client_type not in ["controller", "display"]:
            raise WebSocketDisconnect()

        if client_type == "display" and self.has_display_client:
            # Will only permit one display client
            # TODO: Add custom error message for this
            raise WebSocketDisconnect()

        client = ConnectionClient()
        client.websocket = websocket
        client.client_type = client_type

        return client

    async def disconnect(self, client: ConnectionClient):
        self.active_connections.remove(client)
        await self.broadcast_client_count()

    async def broadcast_command(self, command: str, data):
        for connection in self.active_connections:
            await connection.send_command(command, data)

    async def broadcast_client_count(self):
        return await self.broadcast_command("client_count", len(self.active_connections))

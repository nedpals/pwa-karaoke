from typing import Literal
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from nanoid import generate as generate_nanoid

class ConnectionClient:
    id: str
    websocket: WebSocket
    client_type: Literal["controller", "display"]

    def __init__(self, websocket: WebSocket, client_type: Literal["controller", "display"]):
        self.id = generate_nanoid()
        self.websocket = websocket
        self.client_type = client_type

    async def send_command(self, command: str, data):
        if self.websocket.client_state != WebSocketState.CONNECTED:
            raise WebSocketDisconnect()
        try:
            await self.websocket.send_json([command, data])
        except Exception:
            # Connection is closed, re-raise to trigger cleanup
            raise WebSocketDisconnect()

    async def receive(self) -> tuple[str, any]:
        if self.websocket.client_state != WebSocketState.CONNECTED:
            raise WebSocketDisconnect()
        try:
            data = await self.websocket.receive_json()
            if not isinstance(data, list) or len(data) != 2:
                raise WebSocketDisconnect()
            return data[0], data[1]
        except Exception:
            # Connection is closed or invalid, re-raise to trigger cleanup
            raise WebSocketDisconnect()


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
            # Client disconnected during handshake
            return None
        except Exception:
            # Other handshake errors
            try:
                await websocket.send_json(["error", "Invalid handshake"])
                await websocket.close()
            except Exception:
                # Connection already closed
                pass
            return None

    async def handshake(self, websocket: WebSocket) -> ConnectionClient:
        data = await websocket.receive_json()
        if not isinstance(data, list) or data[0] != "handshake":
            raise WebSocketDisconnect()

        client_type = data[1]
        if client_type not in ["controller", "display"]:
            raise WebSocketDisconnect()

        # if client_type == "display" and self.has_display_client:
            # Will only permit one display client
            # TODO: Add custom error message for this
            # raise WebSocketDisconnect()

        client = ConnectionClient(websocket, client_type)
        if client_type == "display":
            self.has_display_client = True

        return client

    async def disconnect(self, client: ConnectionClient):
        if client in self.active_connections:
            self.active_connections.remove(client)
        if client.client_type == "display":
            self.has_display_client = False
        await self.broadcast_client_count()

    async def broadcast_command(self, command: str, data, clients=None):
        # Use provided clients list or all active connections
        connections = list(clients if clients is not None else self.active_connections)
        disconnected_clients = []

        for connection in connections:
            try:
                await connection.send_command(command, data)
            except Exception:
                # Mark for removal
                disconnected_clients.append(connection)

        # Remove failed connections and update client count if needed
        if disconnected_clients:
            for client in disconnected_clients:
                await self.disconnect(client)

    async def broadcast_client_count(self):
        return await self.broadcast_command("client_count", len(self.active_connections))

    def get_controllers(self):
        return [client for client in self.active_connections if client.client_type == "controller"]

    def get_display_clients(self):
        return [client for client in self.active_connections if client.client_type == "display"]

    async def broadcast_to_displays(self, command: str, data):
        await self.broadcast_command(command, data, clients=self.get_display_clients())

    async def broadcast_to_controllers(self, command: str, data):
        await self.broadcast_command(command, data, clients=self.get_controllers())

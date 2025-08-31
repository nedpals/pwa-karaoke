from typing import Literal
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

class ConnectionClient:
    websocket: WebSocket
    client_type: Literal["controller", "display"]

    async def send_command(self, command: str, data):
        try:
            await self.websocket.send_json([command, data])
        except Exception:
            # Connection is closed, ignore the error
            pass

    async def receive(self, attempt = 0) -> tuple[str, any]:
        if attempt > 3:
            raise Exception("Failed to receive message after multiple attempts")

        try:
            data = await self.websocket.receive_json()
            if not isinstance(data, list):
                raise Exception("Invalid message format")
            return data[0], data[1]
        except RuntimeError:
            # Handle 'WebSocket is not connected. Need to call "accept" first.' error
            if not self.websocket.client_state == WebSocketState.CONNECTED:
                # Reconnect the websocket
                await self.websocket.accept()
                return await self.receive(attempt + 1)
            else:
                raise


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

        client = ConnectionClient()
        client.websocket = websocket
        client.client_type = client_type

        if client_type == "display":
            self.has_display_client = True

        return client

    async def disconnect(self, client: ConnectionClient):
        if client in self.active_connections:
            self.active_connections.remove(client)
        if client.client_type == "display":
            self.has_display_client = False
        await self.broadcast_client_count()

    async def broadcast_command(self, command: str, data):
        # Create a copy of the list to avoid modification during iteration
        connections = list(self.active_connections)
        for connection in connections:
            try:
                await connection.send_command(command, data)
            except Exception:
                # Remove failed connections
                if connection in self.active_connections:
                    self.active_connections.remove(connection)
                    if connection.client_type == "display":
                        self.has_display_client = False

    async def broadcast_client_count(self):
        return await self.broadcast_command("client_count", len(self.active_connections))

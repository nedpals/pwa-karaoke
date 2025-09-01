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
        self.controller_leader: ConnectionClient | None = None

    async def connect(self, websocket: WebSocket):
        try:
            await websocket.accept()
            client = await self.handshake(websocket)
            self.active_connections.append(client)
            print(f"[DEBUG] Client connected: {client.client_type} ({client.id})")
            print(f"[DEBUG] Total active connections: {len(self.active_connections)}")
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
        elif client_type == "controller":
            await self._ensure_controller_leader()

        return client

    async def disconnect(self, client: ConnectionClient):
        if client in self.active_connections:
            self.active_connections.remove(client)
        if client.client_type == "display":
            self.has_display_client = False
        elif client.client_type == "controller" and self.controller_leader == client:
            # Leader disconnected, elect new leader
            await self._ensure_controller_leader()
        await self.broadcast_client_count()

    async def broadcast_command(self, command: str, data, clients=None):
        # Use provided clients list or all active connections
        connections = list(clients if clients is not None else self.active_connections)
        disconnected_clients = []

        print(f"[DEBUG] broadcast_command: {command} to {len(connections)} clients")
        for i, connection in enumerate(connections):
            print(f"[DEBUG] Sending {command} to client {i}: {connection.client_type} ({connection.id})")
            try:
                await connection.send_command(command, data)
                print(f"[DEBUG] Successfully sent {command} to {connection.client_type}")
            except Exception as e:
                print(f"[DEBUG] Failed to send {command} to {connection.client_type}: {e}")
                # Mark for removal
                disconnected_clients.append(connection)

        # Remove failed connections and update client count if needed
        if disconnected_clients:
            print(f"[DEBUG] Removing {len(disconnected_clients)} disconnected clients")
            for client in disconnected_clients:
                await self.disconnect(client)

    async def broadcast_client_count(self):
        return await self.broadcast_command("client_count", len(self.active_connections))

    def get_controllers(self):
        return [client for client in self.active_connections if client.client_type == "controller"]

    def get_display_clients(self):
        return [client for client in self.active_connections if client.client_type == "display"]

    async def broadcast_to_displays(self, command: str, data):
        display_clients = self.get_display_clients()
        controller_clients = self.get_controllers()
        print(f"[DEBUG] Connected clients: {len(controller_clients)} controllers, {len(display_clients)} displays")
        print(f"[DEBUG] Broadcasting {command} to {len(display_clients)} display clients")
        await self.broadcast_command(command, data, clients=display_clients)

    async def broadcast_to_controllers(self, command: str, data):
        await self.broadcast_command(command, data, clients=self.get_controllers())

    def is_controller_leader(self, client: ConnectionClient) -> bool:
        return self.controller_leader == client

    async def _ensure_controller_leader(self):
        controllers = self.get_controllers()
        
        if not controllers:
            self.controller_leader = None
            return
            
        # If current leader is still connected, keep it
        if self.controller_leader and self.controller_leader in controllers:
            return
            
        # Elect first controller as leader (simple but effective)
        self.controller_leader = controllers[0]
        
        # Notify all controllers about their leadership status
        for controller in controllers:
            is_leader = (controller == self.controller_leader)
            try:
                await controller.send_command("leader_status", {"is_leader": is_leader})
            except Exception:
                # Controller disconnected, will be cleaned up later
                pass

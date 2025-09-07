from typing import Optional, List, Dict
from fastapi import WebSocket

from client_manager import ClientManager, ConnectionClient
from room import RoomManager, Room


class SessionManager:
    def __init__(self):
        self.client_manager = ClientManager()
        self.room_manager = RoomManager()
        self.room_leaders: Dict[str, Optional[ConnectionClient]] = {}
    
    # Client connection management
    async def connect_client(self, websocket: WebSocket) -> Optional[ConnectionClient]:
        client = await self.client_manager.connect(websocket)
        # Client starts without being in any room - must call join_room explicitly
        return client
    
    async def disconnect_client(self, client: ConnectionClient):
        room_id = client.room_id
        
        await self.client_manager.disconnect(client)
        
        # Only handle room-specific cleanup if client was in a room
        if room_id:
            was_leader = self.room_leaders.get(room_id) == client
            
            if was_leader:
                # Elect new leader if the disconnected client was the leader
                await self.ensure_room_controller_leader(room_id)
            
            await self.broadcast_room_client_count(room_id)
    
    # Room management
    def get_room(self, room_id: str) -> Room:
        return self.room_manager.get_room(room_id)
    
    # Room-aware client operations
    def get_room_clients(self, room_id: str) -> List[ConnectionClient]:
        return [client for client in self.client_manager.active_connections 
                if client.room_id == room_id]
    
    def get_room_controllers(self, room_id: str) -> List[ConnectionClient]:
        return [client for client in self.get_room_clients(room_id) 
                if client.client_type == "controller"]
    
    def get_room_displays(self, room_id: str) -> List[ConnectionClient]:
        return [client for client in self.get_room_clients(room_id) 
                if client.client_type == "display"]
    
    def get_room_client_count(self, room_id: str) -> int:
        return len(self.get_room_clients(room_id))
    
    # Room-specific broadcasting
    async def broadcast_to_room(self, room_id: str, command: str, data):
        if not room_id:
            raise ValueError("Room ID is required for broadcasting")
        room_clients = self.get_room_clients(room_id)
        print(f"[DEBUG] Broadcasting {command} to room {room_id} with {len(room_clients)} clients")
        await self.client_manager.broadcast_command(command, data, clients=room_clients)
    
    async def broadcast_to_room_controllers(self, room_id: str, command: str, data):
        if not room_id:
            raise ValueError("Room ID is required for broadcasting")
        controllers = self.get_room_controllers(room_id)
        print(f"[DEBUG] Broadcasting {command} to room {room_id} controllers with {len(controllers)} clients")
        await self.client_manager.broadcast_command(command, data, clients=controllers)
    
    async def broadcast_to_room_displays(self, room_id: str, command: str, data):
        if not room_id:
            raise ValueError("Room ID is required for broadcasting")
        displays = self.get_room_displays(room_id)
        print(f"[DEBUG] Broadcasting {command} to room {room_id} displays with {len(displays)} clients")
        await self.client_manager.broadcast_command(command, data, clients=displays)
    
    # Client room management
    async def join_room(self, client: ConnectionClient, room_id: str):
        client.room_id = room_id
        room = self.get_room(room_id)
        
        # If controller, ensure leadership is handled
        if client.client_type == "controller":
            await self.ensure_room_controller_leader(room_id)
        
        # Broadcast updated client count to the room
        await self.broadcast_room_client_count(room_id)
        
        return room
    
    async def broadcast_room_client_count(self, room_id: str):
        count = self.get_room_client_count(room_id)
        await self.broadcast_to_room(room_id, "client_count", count)
    
    # Room-scoped controller leadership
    def is_controller_leader(self, client: ConnectionClient) -> bool:
        if not client.room_id:
            return False  # Client not in any room
        return self.room_leaders.get(client.room_id) == client
    
    async def ensure_room_controller_leader(self, room_id: str):
        controllers = self.get_room_controllers(room_id)
        if not controllers:
            self.room_leaders[room_id] = None
            return
            
        current_leader = self.room_leaders.get(room_id)
        if current_leader and current_leader in controllers:
            return  # Current leader still valid
            
        # Elect new leader (first controller)
        self.room_leaders[room_id] = controllers[0]
        
        # Notify all controllers in this room about their leadership status
        for controller in controllers:
            is_leader = (controller == self.room_leaders[room_id])
            try:
                await controller.send_command("leader_status", {"is_leader": is_leader})
            except Exception:
                # Controller disconnected, will be cleaned up later
                pass
    
    def get_health_metrics(self):
        base_metrics = self.client_manager.get_health_metrics()
        
        # Add room-specific leadership info
        room_leadership = {}
        for room_id, leader in self.room_leaders.items():
            room_leadership[room_id] = {
                "has_leader": leader is not None,
                "leader_id": leader.id if leader else None,
                "controllers_count": len(self.get_room_controllers(room_id))
            }
        
        return {
            **base_metrics,
            "room_leadership": room_leadership
        }
    

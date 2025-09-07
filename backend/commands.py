import random
import time
from typing_extensions import Literal

from core.search import KaraokeEntry
from core.player import DisplayPlayerState
from services.karaoke_service import KaraokeService
from client_manager import ConnectionClient, ClientManager
from room import RoomManager

class ClientCommands:
    def __init__(self, client: ConnectionClient, conn_manager: ClientManager, service: KaraokeService, room_manager: RoomManager) -> None:
        self.service = service
        self.client = client
        self.conn_manager = conn_manager
        self.room_manager = room_manager
        self.room = room_manager.get_default_room()  # All clients join default room for now

    async def pong(self, data):
        """Handle pong response from client"""
        self.client.update_pong()
        print(f"[DEBUG] Received pong from {self.client.client_type} ({self.client.id})")

    async def request_full_state(self, data):
        """Handle request for full state synchronization"""
        print(f"[DEBUG] {self.client.client_type} requesting full state sync")
        
        # Send current client count
        await self.client.send_command("client_count", len(self.conn_manager.active_connections))
        
        # Send leader status if controller
        if self.client.client_type == "controller":
            is_leader = self.conn_manager.is_controller_leader(self.client)
            await self.client.send_command("leader_status", {"is_leader": is_leader})
        
        # Request queue and player state from displays
        display_clients = self.conn_manager.get_display_clients()
        if display_clients:
            # Ask display to send current states
            await display_clients[0].send_command("send_full_state", {})
        else:
            # No displays available, send empty states
            await self.client.send_command("queue_update", {
                "items": [],
                "version": 1,
                "timestamp": time.time()
            })
            # Create DisplayPlayerState and send as dict
            empty_state = DisplayPlayerState(
                entry=None,
                play_state="paused",
                current_time=0.0,
                duration=0.0,
                volume=1.0,
                version=1,
                timestamp=time.time()
            )
            await self.client.send_command("player_state", empty_state.model_dump())

    async def _update_player_state(self, state_data):
        if isinstance(state_data, DisplayPlayerState):
            payload = state_data.model_dump()
        else:
            payload = state_data
        await self.conn_manager.broadcast_command("player_state", payload)

    async def _toggle_playback_state(self, playback_state: Literal["play", "pause"]):
        command = "play_song" if playback_state == "play" else "pause_song"
        await self.conn_manager.broadcast_command(command, {})

    async def _broadcast_room_state(self):
        # Broadcast queue update to all clients
        queue_payload = self.room.get_queue_update_payload()
        await self.conn_manager.broadcast_command("queue_update", queue_payload)
        
        if self.room.player_state:
            await self.conn_manager.broadcast_command("player_state", self.room.player_state.model_dump())

class ControllerCommands(ClientCommands):
    async def remove_song(self, payload):
        # Remove song from room queue and broadcast update
        removed = self.room.remove_song(payload["entry_id"])
        if removed:
            await self._broadcast_room_state()

    async def play_next(self, _: None):
        next_song = self.room.play_next()
        if next_song:
            new_player_state = DisplayPlayerState(
                entry=next_song.entry,
                play_state="playing",
                current_time=0.0,
                duration=0.0,
                volume=self.room.player_state.volume if self.room.player_state else 0.5,
                version=int(time.time() * 1000),
                timestamp=time.time()
            )
        else:
            new_player_state = DisplayPlayerState(
                entry=None,
                play_state="finished",
                current_time=0.0,
                duration=0.0,
                volume=self.room.player_state.volume if self.room.player_state else 1,
                version=int(time.time() * 1000),
                timestamp=time.time()
            )
        
        if "new_player_state" in locals():
            self.room.update_player_state(new_player_state)
        await self._broadcast_room_state()

    async def queue_song(self, payload):
        
        entry = KaraokeEntry.parse_obj(payload)
        print(f"[DEBUG] Controller queue_song received: {entry.title} by {entry.artist}")
        
        # Add song to room queue and broadcast update
        self.room.add_song(entry)
        await self._broadcast_room_state()

    async def queue_next_song(self, payload):
        # Move song to next position in room queue and broadcast update
        moved = self.room.move_to_next(payload["entry_id"])
        if moved:
            await self._broadcast_room_state()

    async def clear_queue(self, _: None):
        # Clear room queue and broadcast update
        self.room.clear_queue()
        await self._broadcast_room_state()

    async def play_song(self, _: None):
        await self._toggle_playback_state("play")

    async def pause_song(self, _: None):
        await self._toggle_playback_state("pause")

    async def player_state(self, _state):
        await self._update_player_state(_state)

    async def request_queue_update(self, _: None):
        # Controller requests current queue state from display
        displays = self.conn_manager.get_display_clients()
        if displays:
            # Ask display to send current queue state
            await displays[0].send_command("send_current_queue", {})

    async def set_volume(self, payload):
        await self.conn_manager.broadcast_to_displays("set_volume", payload["volume"])

class DisplayCommands(ClientCommands):
    async def _request_sync_from_controller(self):
        controllers = self.conn_manager.get_controllers()
        if not controllers:
            return None

        random_controller = random.choice(controllers)

        try:
            await random_controller.send_command("request_player_state", {})
            return random_controller
        except Exception:
            # Controller disconnected, remove it
            await self.conn_manager.disconnect(random_controller)
            return None

    async def update_player_state(self, _state):
        # Broadcast the updated player state to all clients
        #
        # TIP: When the song is finished, the display client should send a "finished" state
        # so that the controller clients will be the ones to request to play the next song
        await self._update_player_state(_state)

    async def request_queue_update(self, _: None):
        # Request current player state from a random controller
        requested_controller = await self._request_sync_from_controller()

        # If no controllers available, send empty state
        if not requested_controller:
            await self._update_player_state(DisplayPlayerState(
                entry=None,
                play_state="paused",
                current_time=0.0,
                duration=0.0,
                volume=1.0,
                version=1,
                timestamp=time.time()
            ))

    async def queue_update(self, queue_data):
        await self.conn_manager.broadcast_to_controllers("queue_update", queue_data)

    async def video_loaded(self, payload):
        await self.conn_manager.broadcast_to_controllers("player_state", payload)

    async def send_full_state(self, data):
        """Send full queue and player state to controllers"""
        print("[DEBUG] Display sending full state to controllers")
        
        # This command is typically sent from the display client to synchronize
        # the current queue and player state with all controllers
        # The display should respond by sending queue_update and player_state
        # commands with its current state

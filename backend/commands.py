import time
import asyncio
from typing_extensions import Literal

from core.search import KaraokeEntry
from core.player import DisplayPlayerState
from services.karaoke_service import KaraokeService
from client_manager import ConnectionClient
from session_manager import SessionManager

class ClientCommands:
    def __init__(self, client: ConnectionClient, session_manager: SessionManager, service: KaraokeService) -> None:
        self.service = service
        self.client = client
        self.session_manager = session_manager
        self.room = None
        
    async def _receive_current_state(self):
        if not self.client.room_id:
            await self.client.send_command("client_count", 0)
            return
        
        # Send the current player_state and queue to the client
        await self.client.send_command("client_count", self.session_manager.get_room_client_count(self.client.room_id))
        await self.client.send_command("queue_update", self.room.get_queue_update_payload())
        if self.room.player_state:
            await self.client.send_command("player_state", self.room.player_state.model_dump())

        if self.client.client_type == "controller":
            is_leader = self.session_manager.is_controller_leader(self.client)
            await self.client.send_command("leader_status", {"is_leader": is_leader})

    async def pong(self, data):
        """Handle pong response from client"""
        self.client.update_pong()
        # print(f"[DEBUG] Received pong from {self.client.client_type} ({self.client.id})")

    async def _update_player_state(self, state_data):
        if isinstance(state_data, DisplayPlayerState):
            self.room.update_player_state(state_data)
            payload = state_data.model_dump()
        else:
            state = DisplayPlayerState.parse_obj(state_data)
            self.room.update_player_state(state)
            payload = state_data
        await self.session_manager.broadcast_to_room(self.client.room_id, "player_state", payload)

    async def _toggle_playback_state(self, playback_state: Literal["play", "pause"]):
        command = "play_song" if playback_state == "play" else "pause_song"
        await self.session_manager.broadcast_to_room_displays(self.client.room_id, command, {})

    async def _broadcast_room_state(self):
        # Broadcast queue update to all clients
        queue_payload = self.room.get_queue_update_payload()
        await self.session_manager.broadcast_to_room(self.client.room_id, "queue_update", queue_payload)
        
        if self.room.player_state:
            await self.session_manager.broadcast_to_room_displays(self.client.room_id, "player_state", self.room.player_state.model_dump())

    async def join_room(self, payload):
        room_id = payload.get("room_id", "default")
        self.room = await self.session_manager.join_room(self.client, room_id)
        await self._receive_current_state()
        return {"room_id": room_id, "success": True}
    
    async def play_next(self, _: None):
        next_song = self.room.play_next()
        print(f"[DEBUG] Playing next song: {next_song}")

        await self._update_player_state(DisplayPlayerState(
            entry=next_song.entry if next_song else None,
            play_state="playing" if next_song else "finished",
            current_time=0.0,
            duration=0.0,
            volume=self.room.player_state.volume if self.room.player_state else 0.5,
            version=int(time.time() * 1000),
            timestamp=time.time()
        ))

        await self._broadcast_room_state()

class ControllerCommands(ClientCommands):
    async def remove_song(self, payload):
        removed = self.room.remove_song(payload["entry_id"])
        if removed:
            await self._broadcast_room_state()

    async def queue_song(self, payload):
        entry = KaraokeEntry.parse_obj(payload)
        print(f"[DEBUG] Controller queue_song received: {entry.title} by {entry.artist}")
        
        is_previously_empty = self.room.is_empty
        is_currently_playing = self.room.player_state and self.room.player_state.entry is not None

        self.room.add_song(entry)
        await asyncio.sleep(0.1)  # Small delay to ensure state consistency
        await self._broadcast_room_state()
        
        if is_previously_empty and not is_currently_playing:
            # Directly play if queue is empty
            await self.play_next(None)

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

    async def set_volume(self, payload):
        await self.session_manager.broadcast_to_room_displays(self.client.room_id, "set_volume", payload["volume"])

class DisplayCommands(ClientCommands):
    async def update_player_state(self, _state):
        await self._update_player_state(_state)

    async def queue_update(self, queue_data):
        await self.session_manager.broadcast_to_room_controllers(self.client.room_id, "queue_update", queue_data)

    async def video_loaded(self, payload):
        await self.session_manager.broadcast_to_room_controllers(self.client.room_id, "player_state", payload)

import random
import time

from typing_extensions import Literal
from core.search import KaraokeEntry
from services.karaoke_service import KaraokeService
from client_manager import ConnectionClient, ClientManager

from pydantic import BaseModel

class DisplayPlayerState(BaseModel):
    entry: KaraokeEntry | None
    play_state: Literal["playing", "paused", "finished", "buffering"]
    current_time: float = 0.0
    duration: float = 0.0
    version: int = 1
    timestamp: float

class ClientCommands:
    def __init__(self, client: ConnectionClient, conn_manager: ClientManager, service: KaraokeService) -> None:
        self.service = service
        self.client = client
        self.conn_manager = conn_manager

    async def _update_player_state(self, _state):
        state = DisplayPlayerState(**_state) if not isinstance(_state, DisplayPlayerState) else _state
        await self.conn_manager.broadcast_command("player_state", state.model_dump())

    async def _toggle_playback_state(self, playback_state: Literal["play", "pause"]):
        command = "play_song" if playback_state == "play" else "pause_song"
        await self.conn_manager.broadcast_command(command, {})

class ControllerCommands(ClientCommands):
    async def remove_song(self, id_to_delete: str):
        # Relay remove command to displays
        await self.conn_manager.broadcast_to_displays("remove_song", id_to_delete)

    async def play_next(self, _: None):
        await self.conn_manager.broadcast_to_displays("play_next", None)

    async def queue_song(self, _entry_data):
        entry = KaraokeEntry(**_entry_data) if not isinstance(_entry_data, KaraokeEntry) else _entry_data
        print(f"[DEBUG] Controller queue_song received: {entry.title} by {entry.artist}")
        await self.conn_manager.broadcast_to_displays("queue_song", entry.model_dump())

    async def queue_next_song(self, entry_id: str):
        await self.conn_manager.broadcast_to_displays("queue_next_song", entry_id)

    async def clear_queue(self, _: None):
        await self.conn_manager.broadcast_to_displays("clear_queue", None)

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
        # Display requests sync - original logic
        # Request current player state from a random controller
        requested_controller = await self._request_sync_from_controller()

        # If no controllers available, send empty state
        if not requested_controller:
            await self._update_player_state(DisplayPlayerState(
                entry=None,
                play_state="paused",
                current_time=0.0,
                duration=0.0,
                version=1,
                timestamp=time.time()
            ))

    async def queue_update(self, queue_data):
        # Display is updating controllers with new queue state
        await self.conn_manager.broadcast_to_controllers("queue_update", queue_data)

    async def video_loaded(self, state: DisplayPlayerState):
        # Sync this state back to all controllers using the standard player_state command
        await self.conn_manager.broadcast_to_controllers("player_state", state.model_dump())

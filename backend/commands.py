import random

from typing_extensions import Literal
from core.queue import KaraokeQueue
from core.search import KaraokeEntry
from services.karaoke_service import KaraokeService
from client_manager import ConnectionClient, ClientManager

from pydantic import BaseModel

class DisplayPlayerState(BaseModel):
    entry: KaraokeEntry | None
    play_state: Literal["playing", "paused", "finished", "buffering"]
    current_time: float = 0.0
    duration: float = 0.0

class ClientCommands:
    def __init__(self, client: ConnectionClient, queue: KaraokeQueue, conn_manager: ClientManager, service: KaraokeService) -> None:
        self.service = service
        self.client = client
        self.conn_manager = conn_manager
        self.queue = queue

    async def _queue_update(self):
        await self.conn_manager.broadcast_command("queue_update", self.queue.model_dump())

    async def _update_player_state(self, state: DisplayPlayerState):
        await self.conn_manager.broadcast_command("player_state", state.model_dump())

    async def _toggle_playback_state(self, playback_state: Literal["play", "pause"]):
        command = "play_song" if playback_state == "play" else "pause_song"
        await self.conn_manager.broadcast_command(command, {})

    async def _auto_play_first_song(self):
        """Auto-play the first song in queue with initial player state"""
        if len(self.queue.items) == 0:
            return

        await self._update_player_state(DisplayPlayerState(
            entry=self.queue.items[0].entry,
            play_state="playing",
            current_time=0.0,
            duration=0.0
        ))

    async def _auto_stop_playback(self):
        """Auto-stop playback when queue is empty"""
        player_state = DisplayPlayerState(
            entry=None,
            play_state="paused",
            current_time=0.0,
            duration=0.0
        )
        await self._update_player_state(player_state)

class ControllerCommands(ClientCommands):
    async def remove_song(self, id_to_delete: str):
        self.queue.dequeue(id_to_delete)
        await self._queue_update()

    async def play_next(self, _: None):
        # Backend handles validation - only proceed if there are items in queue
        if len(self.queue.items) == 0:
            return  # Nothing to play next

        current_playing = self.queue.items[0]
        # remove_song will take care of broadcasting the updated queue
        await self.remove_song(current_playing.id)

        # Auto-stop if queue is now empty, or auto-play next song
        if len(self.queue.items) == 0:
            await self._auto_stop_playback()
        else:
            await self._auto_play_first_song()

    async def queue_song(self, entry: KaraokeEntry):
        was_empty = len(self.queue.items) == 0
        self.queue.enqueue(entry)
        await self._queue_update()

        # Auto-play if queue was empty before adding this song
        if was_empty:
            await self._auto_play_first_song()

    async def queue_next_song(self, entry_id: str):
        self.queue.queue_next(entry_id)
        await self._queue_update()

    async def clear_queue(self, _: None):
        # Clear all items from the queue
        self.queue.items.clear()
        await self._queue_update()

        # Auto-stop when queue is cleared
        await self._auto_stop_playback()

    async def play_song(self, _: None):
        await self._toggle_playback_state("play")

    async def pause_song(self, _: None):
        await self._toggle_playback_state("pause")

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

    async def update_player_state(self, state: DisplayPlayerState):
        # Broadcast the updated player state to all clients
        #
         # TIP: When the song is finished, the display client should send a "finished" state
        # so that the controller clients will be the ones to request to play the next song
        await self._update_player_state(state)

    async def request_queue_update(self, _: None):
        await self._queue_update()

        # Request current player state from a random controller
        requested_controller = await self._request_sync_from_controller()

        # If no controllers available, send empty state
        if not requested_controller:
            await self._update_player_state(DisplayPlayerState(
                entry=None,
                play_state="paused",
                current_time=0.0,
                duration=0.0
            ))

    async def video_loaded(self, state: DisplayPlayerState):
        # Sync this state back to all controllers using the standard player_state command
        await self.conn_manager.broadcast_to_controllers("player_state", state.model_dump())

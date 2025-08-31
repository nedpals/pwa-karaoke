from typing_extensions import Literal
from core.queue import KaraokeQueue
from core.search import KaraokeEntry
from services.karaoke_service import KaraokeService
from client_manager import ConnectionClient, ClientManager

from pydantic import BaseModel

class DisplayPlayerState(BaseModel):
    entry: KaraokeEntry | None
    play_state: Literal["playing", "paused", "finished"]
    current_time: float = 0.0
    duration: float = 0.0

class ClientCommands:
    def __init__(self, client: ConnectionClient, queue: KaraokeQueue, conn_manager: ClientManager, service: KaraokeService) -> None:
        self.service = service
        self.client = client
        self.conn_manager = conn_manager
        self.queue = queue

    async def _queue_update(self):
        await self.client.send_command("queue_update", self.queue.model_dump())

    async def _update_player_state(self, state: DisplayPlayerState):
        await self.conn_manager.broadcast_command("player_state", state.model_dump())

    async def _toggle_playback_state(self, playback_state: Literal["play", "pause"]):
        command = "play_song" if playback_state == "play" else "pause_song"
        await self.conn_manager.broadcast_command(command, {})

class ControllerCommands(ClientCommands):
    async def remove_song(self, id_to_delete: str):
        self.queue.dequeue(id_to_delete)
        await self._queue_update()

    async def play_next(self, _: None):
        current_playing = self.queue.items[0] if len(self.queue.items) > 0 else None
        if not current_playing:
            # There's nothing to play next in the queue
            return

        # remove_song will take care of broadcasting the updated queue
        # and the display client will handle playing the next song
        await self.remove_song(current_playing.id)

    async def queue_song(self, entry: KaraokeEntry):
        self.queue.enqueue(entry)
        await self._queue_update()

    async def queue_next_song(self, entry_id: str):
        self.queue.queue_next(entry_id)
        await self._queue_update()

    async def play_song(self, _: None):
        await self._toggle_playback_state("play")

    async def pause_song(self, _: None):
        await self._toggle_playback_state("pause")

class DisplayCommands(ClientCommands):
    async def update_player_state(self, state: DisplayPlayerState):
        # TIP: When the song is finished, the display client should send a "finished" state
        # so that the controller clients will be the ones to request to play the next song
        await self._update_player_state(state)

    async def request_queue_update(self, _: None):
        await self._queue_update()

    async def request_current_song(self, _: None):
        current_playing = self.queue.items[0] if len(self.queue.items) > 0 else None
        await self.client.send_command("current_song", current_playing.model_dump() if current_playing else None)

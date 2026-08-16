import time
import asyncio
from typing_extensions import Literal

from nanoid import generate as generate_nanoid

from core.search import KaraokeEntry
from core.player import DisplayPlayerState
from core.score import SongScore, roll_score, score_from_performance
from services.karaoke_service import KaraokeService
from client_manager import ConnectionClient
from session_manager import SessionManager

REACTION_RATE_LIMIT = 8
REACTION_RATE_WINDOW = 3.0

# Room wide ceiling so a crowded room cannot scale the flood past what a
# display can show, and so reconnecting cannot buy a fresh budget
ROOM_REACTION_RATE_LIMIT = 20
ROOM_REACTION_RATE_WINDOW = 3.0

SCORE_RATE_LIMIT = 4
SCORE_RATE_WINDOW = 10.0

# How long a controller with a microphone has to report before the machine
# makes something up. The display holds the finished song for longer than this.
SCORE_GRACE_SECONDS = 1.0

# Nothing under this was sung at all, so it passes without a score.
MIN_SCORED_SECONDS = 5.0

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
        await self.client.send_command("room_settings", self.room.get_settings_payload())
        if self.room.player_state:
            await self.client.send_command("player_state", self.room.player_state.model_dump())

        if self.room.score:
            await self.client.send_command("score", self.room.score.model_dump())

        if self.client.client_type == "display":
            is_leader = self.session_manager.is_display_leader(self.client)
            await self.client.send_command("leader_status", {"is_leader": is_leader})

    async def pong(self, data):
        """Handle pong response from client"""
        self.client.update_pong()
        # print(f"[DEBUG] Received pong from {self.client.client_type} ({self.client.id})")

    async def _update_player_state(self, state_data):
        state = state_data if isinstance(state_data, DisplayPlayerState) else DisplayPlayerState.parse_obj(state_data)

        previous = self.room.player_state.entry if self.room.player_state else None
        previous_entry_id = previous.id if previous else None
        entry_id = state.entry.id if state.entry else None

        self.room.update_player_state(state)

        if entry_id != previous_entry_id:
            self.room.clear_score()

        # Broadcast the room's copy so clients see the server-stamped version
        await self.session_manager.broadcast_to_room(self.client.room_id, "player_state", self.room.player_state.model_dump())

        if entry_id and state.play_state == "finished":
            asyncio.create_task(
                self._settle_score(self.room, self.client.room_id, entry_id, state.current_time)
            )

    async def _broadcast_score(self, room_id: str, score: SongScore):
        await self.session_manager.broadcast_to_room(room_id, "score", score.model_dump())

    async def _settle_score(self, room, room_id: str, entry_id: str, played_seconds: float):
        if not room.begin_score_settle(entry_id):
            return

        try:
            if played_seconds < MIN_SCORED_SECONDS:
                return

            await asyncio.sleep(SCORE_GRACE_SECONDS)
            if room.has_score_for(entry_id):
                return

            score = room.set_score(entry_id, roll_score(), "auto")
            await self._broadcast_score(room_id, score)
        finally:
            room.end_score_settle(entry_id)

    async def _toggle_playback_state(self, playback_state: Literal["play", "pause"]):
        command = "play_song" if playback_state == "play" else "pause_song"
        await self.session_manager.broadcast_to_room_displays(self.client.room_id, command, {})

    async def _broadcast_room_state(self, should_prefetch: bool = True):
        # Broadcast queue update to all clients
        queue_payload = self.room.get_queue_update_payload()
        await self.session_manager.broadcast_to_room(self.client.room_id, "queue_update", queue_payload)

        if self.room.player_state:
            await self.session_manager.broadcast_to_room_displays(self.client.room_id, "player_state", self.room.player_state.model_dump())

        if should_prefetch:
            asyncio.create_task(self._prefetch_video_urls())

    async def _prefetch_video_urls(self):
        """Prefetch video URLs for the first 2 songs in the queue"""
        if not self.room or not self.room.queue.items:
            return

        # Get first 2 songs that don't already have video URLs
        songs_to_prefetch = []
        for item in self.room.queue.items[:2]:
            if not item.entry.video_url:
                songs_to_prefetch.append(item)

        if not songs_to_prefetch:
            return

        print(f"[PREFETCH] Starting prefetch for {len(songs_to_prefetch)} songs in room {self.client.room_id}")

        tasks = []
        for item in songs_to_prefetch:
            task = self._prefetch_single_video_url(item)
            tasks.append(task)

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _prefetch_single_video_url(self, queue_item):
        """Prefetch video URL for a single queue item"""
        try:
            print(f"[PREFETCH] Fetching URL for: {queue_item.entry.title} by {queue_item.entry.artist}")
            video_response = await self.service.get_video_url(queue_item.entry)
            if video_response.video_url:
                queue_item.entry.video_url = video_response.video_url
                print(f"[PREFETCH] ✓ Successfully prefetched URL for: {queue_item.entry.title}")
                await self._broadcast_room_state(should_prefetch=False)
            else:
                print(f"[PREFETCH] ✗ No URL found for: {queue_item.entry.title}")

        except Exception as e:
            # Silent failure - client will handle fetching if needed
            print(f"[PREFETCH] ✗ Failed to prefetch URL for {queue_item.entry.title}: {e}")

    async def join_room(self, payload):
        room_id = payload.get("room_id", "default")
        nickname = payload.get("nickname")
        self.room = await self.session_manager.join_room(self.client, room_id, nickname)
        await self._receive_current_state()
        return {"room_id": room_id, "nickname": nickname, "success": True}
    
    async def play_next(self, payload=None):
        # Only a display rolling over at the end of a song is gated by autoplay.
        # Manual skips from a remote always advance.
        is_auto = bool(payload.get("auto")) if isinstance(payload, dict) else False

        # Nothing reserved means nothing is being held back, so let it fall
        # through and clear the room the same way an autoplaying one does.
        if is_auto and not self.room.autoplay and self.room.queue.items:
            print(f"[DEBUG] Autoplay is off for room {self.client.room_id} - holding the queue")
            await self._hold_at_end_of_song()
            return {"advanced": False, "autoplay": False}

        # A manual skip stops on the outgoing song long enough to score it
        if not is_auto and await self._score_skipped_song():
            return {"advanced": False, "scoring": True}

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
        return {"advanced": next_song is not None, "autoplay": self.room.autoplay}

    async def _score_skipped_song(self) -> bool:
        """Hold a skipped song on screen for its score. True when it did."""
        state = self.room.player_state
        entry = state.entry if state else None

        # Already finished means this is the display coming back for the
        # advance it was held off from
        if not entry or state.play_state == "finished":
            return False

        if state.current_time < MIN_SCORED_SECONDS or self.room.has_score_for(entry.id):
            return False

        # Nobody was going to report on a song no one let finish, so there is
        # nothing to wait for
        score = self.room.set_score(entry.id, roll_score(), "auto")

        await self._hold_at_end_of_song()
        await self._broadcast_score(self.client.room_id, score)
        await self.session_manager.broadcast_to_room_displays(
            self.client.room_id, "scoring", {"entry_id": entry.id, "quick": True}
        )
        return True

    async def _hold_at_end_of_song(self):
        """Stop on the finished song and leave the queue untouched."""
        current = self.room.player_state
        await self._update_player_state(DisplayPlayerState(
            entry=current.entry if current else None,
            play_state="finished",
            current_time=current.current_time if current else 0.0,
            duration=current.duration if current else 0.0,
            volume=current.volume if current else 0.5,
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

        self.room.add_song(entry, self.client.nickname)
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

    async def send_reaction(self, payload):
        if not self.room:
            return

        if not self.client.allow_action("send_reaction", REACTION_RATE_LIMIT, REACTION_RATE_WINDOW):
            return

        if not self.room.allow_action("reaction", ROOM_REACTION_RATE_LIMIT, ROOM_REACTION_RATE_WINDOW):
            return

        await self.session_manager.broadcast_to_room_displays(
            self.client.room_id,
            "reaction",
            {
                "id": generate_nanoid(),
                "reaction": payload["reaction"],
                "timestamp": time.time(),
            },
        )

    async def submit_score(self, payload):
        if not self.room:
            return

        if not self.client.allow_action("submit_score", SCORE_RATE_LIMIT, SCORE_RATE_WINDOW):
            return

        # Only the remote that reserved the song is listened to, so a room
        # full of microphones cannot score over each other
        if not self.room.current_singer or self.client.nickname != self.room.current_singer:
            return

        entry_id = payload["entry_id"]
        state = self.room.player_state
        current = state.entry if state else None

        # Only the song on screen can be scored, and only once. A second
        # controller arriving late loses to the one already counted.
        if not current or current.id != entry_id:
            return

        if state.current_time < MIN_SCORED_SECONDS:
            return

        if self.room.has_score_for(entry_id):
            return

        score = self.room.set_score(entry_id, score_from_performance(payload["performance"]), "mic")
        await self._broadcast_score(self.client.room_id, score)

    async def set_autoplay(self, payload):
        changed = self.room.set_autoplay(payload["enabled"])
        if changed:
            await self.session_manager.broadcast_to_room(
                self.client.room_id, "room_settings", self.room.get_settings_payload()
            )
        return {"autoplay": self.room.autoplay}

class DisplayCommands(ClientCommands):
    async def update_player_state(self, _state):
        # Only allow leader displays to update player state
        if not self.session_manager.is_display_leader(self.client):
            print(f"[DEBUG] Non-leader display {self.client.id} attempted to update player state - ignoring")
            return

        await self._update_player_state(_state)

    async def queue_update(self, queue_data):
        await self.session_manager.broadcast_to_room_controllers(self.client.room_id, "queue_update", queue_data)

    async def video_loaded(self, payload):
        # Only allow leader displays to broadcast video loaded state
        if not self.session_manager.is_display_leader(self.client):
            print(f"[DEBUG] Non-leader display {self.client.id} attempted to broadcast video loaded - ignoring")
            return

        # The display does not track the singer, so re-stamp it rather than
        # let this update blank it on every remote.
        if isinstance(payload, dict):
            payload = {**payload, "singer": self.room.current_singer if payload.get("entry") else None}

        await self.session_manager.broadcast_to_room_controllers(self.client.room_id, "player_state", payload)

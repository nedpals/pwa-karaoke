import time
import asyncio
from typing_extensions import Literal

from nanoid import generate as generate_nanoid

from core.search import KaraokeEntry
from core.player import DisplayPlayerState
from core.room import MIN_SCORED_SECONDS
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

class ClientCommands:
    def __init__(self, client: ConnectionClient, session_manager: SessionManager, service: KaraokeService) -> None:
        self.service = service
        self.client = client
        self.session_manager = session_manager
        self.room = None
        
    async def _receive_current_state(self):
        if not self.client.room_id:
            await self.client.send_command("client_count", {"total": 0, "controllers": 0, "displays": 0})
            return
        
        # Send the current player_state and queue to the client
        await self.client.send_command("client_count", self.session_manager.get_room_client_counts(self.client.room_id))
        await self.client.send_command("queue_update", self.room.get_queue_update_payload())
        await self.client.send_command("room_settings", self.room.get_settings_payload())
        if self.room.player_state:
            await self.client.send_command("player_state", self.room.player_state.model_dump())

        if self.client.client_type == "controller":
            target = self.room.current_singer_device_id
            await self.client.send_command(
                "scoring_turn",
                {"active": bool(target) and self.client.device_id == target},
            )

        if self.client.client_type == "display":
            is_leader = self.session_manager.is_display_leader(self.client)
            await self.client.send_command("leader_status", {"is_leader": is_leader})

    async def pong(self, data):
        """Handle pong response from client"""
        self.client.update_pong()
        # print(f"[DEBUG] Received pong from {self.client.client_type} ({self.client.id})")

    async def _update_player_state(self, state_data):
        state = state_data if isinstance(state_data, DisplayPlayerState) else DisplayPlayerState.parse_obj(state_data)

        previous_item_id = self.room.player_state.item_id if self.room.player_state else None

        self.room.update_player_state(state)

        # Keyed on the reservation: the same song queued twice is a new turn for
        # a different phone, and comparing entry ids would miss the handover
        if self.room.player_state.item_id != previous_item_id:
            await self._send_scoring_turns(self.client.room_id)

        # Broadcast the room's copy so clients see the server-stamped version
        await self.session_manager.broadcast_to_room(self.client.room_id, "player_state", self.room.player_state.model_dump())


    async def _send_scoring_turns(self, room_id: str):
        target = self.room.current_singer_device_id

        for client in self.session_manager.get_room_controllers(room_id):
            mine = bool(target) and client.device_id == target
            try:
                await client.send_command("scoring_turn", {"active": mine})
            except Exception:
                # Dropped remotes are cleaned up elsewhere
                pass

    async def _toggle_playback_state(self, playback_state: Literal["play", "pause"]):
        """Pass a remote's play or pause to the screens.

        Same shape as a skip: the room does not set its own play state, it
        learns it from the leader's report of what the element actually did.
        """
        command = "play_song" if playback_state == "play" else "pause_song"
        displays = self.session_manager.get_room_displays(self.client.room_id)
        await self.session_manager.broadcast_to_room_displays(self.client.room_id, command, {})
        return {"screens": len(displays)}

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

    async def _remove_song(self, item_id: str):
        removed = self.room.remove_song(item_id)
        if removed:
            await self._broadcast_room_state()
        return removed

    async def join_room(self, payload):
        room_id = payload.get("room_id", "default")
        nickname = payload.get("nickname")
        device_id = payload.get("device_id")
        self.room = await self.session_manager.join_room(self.client, room_id, nickname, device_id)
        await self._receive_current_state()
        return {"room_id": room_id, "nickname": nickname, "success": True}
    
    async def play_next(self, payload=None):
        """Pop the queue. Asking is the whole decision.

        When to start, whether to hold a song for its score, and what autoplay
        means all belong to the leader screen, which is the only party that
        knows how far the song actually got.
        """
        from_item_id = payload.get("from_item_id") if isinstance(payload, dict) else None
        current_item_id = self.room.player_state.item_id if self.room.player_state else None

        # The caller was deciding about a turn the room has already left, so
        # honouring it would swallow whatever is playing now
        if from_item_id and from_item_id != current_item_id:
            print(f"[DEBUG] Ignoring stale play_next for {from_item_id} in room {self.client.room_id}")
            return {"advanced": False, "stale": True}

        next_song = self.room.play_next()
        print(f"[DEBUG] Playing next song: {next_song}")

        await self._update_player_state(DisplayPlayerState(
            entry=next_song.entry if next_song else None,
            play_state="playing" if next_song else "idle",
            current_time=0.0,
            duration=0.0,
            volume=self.room.player_state.volume if self.room.player_state else 0.5,
            version=int(time.time() * 1000),
            timestamp=time.time()
        ))

        await self._broadcast_room_state()
        return {"advanced": next_song is not None}

class ControllerCommands(ClientCommands):
    async def remove_song(self, payload):
        await self._remove_song(payload["entry_id"])

    async def skip_song(self, _: None):
        """Pass a remote's Next to the screens and let the leader work it out.

        Whether a skip ends the song for its score or moves straight on depends
        on how far it got, which only a screen knows.
        """
        displays = self.session_manager.get_room_displays(self.client.room_id)
        await self.session_manager.broadcast_to_room_displays(
            self.client.room_id, "skip_request", {}
        )
        return {"screens": len(displays)}

    async def queue_song(self, payload):
        entry = KaraokeEntry.parse_obj(payload)
        print(f"[DEBUG] Controller queue_song received: {entry.title} by {entry.artist}")

        self.room.add_song(entry, self.client.nickname, self.client.device_id)
        await asyncio.sleep(0.1)  # Small delay to ensure state consistency

        # Reserving does not start anything. The leader asks when it sees a
        # reservation with nothing on air, which also starts a room a screen
        # joined late.
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
        return await self._toggle_playback_state("play")

    async def pause_song(self, _: None):
        return await self._toggle_playback_state("pause")

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

        # Matched on the reserving device, since a nickname is not unique or owned
        target = self.room.current_singer_device_id
        if not target or self.client.device_id != target:
            return

        item_id = payload["item_id"]
        state = self.room.player_state

        if not state or not state.entry or state.item_id != item_id:
            return

        # Bounds what a remote can claim to have measured, using the same rule
        # the screen used to decide the turn was worth scoring
        if state.current_time < MIN_SCORED_SECONDS:
            return

        await self.session_manager.broadcast_to_room_displays(
            self.client.room_id,
            "score_reading",
            {"item_id": item_id, "performance": payload["performance"]},
        )

    async def set_autoplay(self, payload):
        changed = self.room.set_autoplay(payload["enabled"])
        if changed:
            await self.session_manager.broadcast_to_room(
                self.client.room_id, "room_settings", self.room.get_settings_payload()
            )
        return {"autoplay": self.room.autoplay}

class DisplayCommands(ClientCommands):
    async def remove_song(self, payload):
        """The leader dropping the song it was holding, because Next was pressed.

        Which reservation that is, is the screen's to know: the one on its card.
        """
        if not self.session_manager.is_display_leader(self.client):
            return {"removed": False}

        return {"removed": await self._remove_song(payload["entry_id"])}

    async def update_player_state(self, _state):
        # Only allow leader displays to update player state
        if not self.session_manager.is_display_leader(self.client):
            print(f"[DEBUG] Non-leader display {self.client.id} attempted to update player state - ignoring")
            return

        state = _state if isinstance(_state, DisplayPlayerState) else DisplayPlayerState.parse_obj(_state)
        current = self.room.player_state

        # A report about some other turn is a video element that has not caught
        # up, and accepting it would drag the room back to the previous song.
        current_item_id = current.item_id if current else None
        incoming_item_id = state.item_id if state.entry else None
        if current and incoming_item_id != current_item_id:
            print(f"[DEBUG] Ignoring player state for {incoming_item_id} while {current_item_id} is on air")
            return

        # Finished covers the end of a song, a skip and an autoplay hold. A
        # video element that remounts and starts itself must not reopen it.
        if current and current.play_state == "finished" and state.play_state != "finished":
            print(f"[DEBUG] Ignoring {state.play_state} report for finished turn {current_item_id}")
            return

        await self._update_player_state(state)

    async def queue_update(self, queue_data):
        await self.session_manager.broadcast_to_room_controllers(self.client.room_id, "queue_update", queue_data)

    async def refresh_video_url(self, payload):
        """Re-resolve the URL for the song on air, because it stopped playing.

        The room hands the same dead URL to every screen and to the next reload,
        so it has to be replaced at the source rather than retried.
        """
        if not self.session_manager.is_display_leader(self.client):
            return {"refreshed": False}

        state = self.room.player_state
        entry = state.entry if state else None
        if not entry or entry.id != payload["entry_id"]:
            return {"refreshed": False}

        response = await self.service.get_video_url(entry, refresh=True)
        if not response.video_url:
            print(f"[DEBUG] Could not re-resolve a URL for {entry.id}")
            return {"refreshed": False}

        entry.video_url = response.video_url
        await self._update_player_state(DisplayPlayerState(
            entry=entry,
            play_state="buffering",
            current_time=state.current_time,
            duration=state.duration,
            volume=state.volume,
            version=int(time.time() * 1000),
            timestamp=time.time()
        ))
        return {"refreshed": True}

    async def scoring_state(self, payload):
        if not self.session_manager.is_display_leader(self.client):
            return

        await self.session_manager.broadcast_to_room_controllers(
            self.client.room_id, "scoring_state", {"active": payload["active"]}
        )

    async def publish_score(self, payload):
        if not self.session_manager.is_display_leader(self.client):
            return

        await self.session_manager.broadcast_to_room(
            self.client.room_id,
            "score",
            {
                "item_id": payload["item_id"],
                "score": payload["score"],
                "source": payload["source"],
                "timestamp": time.time(),
            },
        )

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

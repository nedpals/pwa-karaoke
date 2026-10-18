# How the display (player) works

This page is a map of the display code for someone who knows React but has not seen this codebase. It is written so you can read the player code without changing it. Every name below (files, functions, constants, refs, state) is spelled as it appears in the source.

The display is the screen that shows the karaoke video, the idle and scoring screens, and a few overlays. It is served at `/player?room=<id>`. The phones are controllers and live in `ControllerPage.tsx`, which this page does not cover.

The playback flow is spread across many `useEffect` hooks in one provider. They coordinate through refs and through the state the server sends back, not by calling each other. Section 3 follows one song through those effects in order. Section 4 lists everything in tables so you can look names up.

All paths are relative to `frontend/src/` unless they start with `backend/`.

Contents:

1. [Overview](#1-overview)
2. [Screens and AppState](#2-screens-and-appstate)
3. [The life of a song](#3-the-life-of-a-song)
4. [Reference tables](#4-reference-tables)
5. [Failure handling](#5-failure-handling)
6. [Tips for changing this code safely](#6-tips-for-changing-this-code-safely)

## 1. Overview

### What the display does

- Joins a room over the WebSocket as a `display` client (`useRoom("display", nickname)` in `pages/PlayerPage.tsx`).
- Shows one screen at a time, chosen from the room state (section 2).
- Plays the current song's video in a `<video>` element (`pages/player/VideoPlayer.tsx`).
- Decides when a song is over, runs the score screen, and asks the server for the next song (`pages/player/PlayerStateProvider.tsx`).

The server holds the queue and the "player state" (`DisplayPlayerState`: entry, play_state, current_time, volume, and so on). Displays and controllers never change that state directly. They send commands, the server updates the room, and the server broadcasts the result. See [backend/README.md, WebSocket Protocol](../../backend/README.md#websocket-protocol).

### Leader and follower displays

A room can have several displays. The server picks one as the leader: `SessionManager.ensure_room_display_leader()` in `backend/session_manager.py` takes the first display in the room, and sends each display a `leader_status` message with `{"is_leader": boolean}`. If the leader leaves, the same function picks the next display. See [Display Leadership System](../../backend/README.md#display-leadership-system).

On the frontend, `useRoom` stores that message as `isLeader` (the `leader_status` case). It also sets `isLeader` to `false` whenever the socket connects, and the server's `leader_status` follows after joining.

| | Leader display | Follower display |
| --- | --- | --- |
| Sends `update_player_state` | Yes. `updatePlayerState` in `useRoom.ts` only sends when `clientType === "display" && isLeader`, and `DisplayCommands.update_player_state` in `backend/commands.py` also checks `is_display_leader` | No. The call logs and returns. The server would ignore it too |
| Sends `play_next` | Yes | No. `playNext` in `useRoom.ts` returns `Promise.resolve({})` for a non-leader display |
| Sends `publish_score`, `scoring_state`, `refresh_video_url`, `remove_song` | Yes | The server ignores them from a non-leader (`is_display_leader` check in each handler in `backend/commands.py`) |
| Decides what Next and Play mean | Yes (the `skipRequest` and `playbackRequest` effects only act when `isLeader`) | No. It records the request as handled and returns |
| Player state it renders | The raw `playerState` from `useRoom` | `useSmartSync(rawPlayerState, isLeader)` output |
| `<video>` element | Rendered, follows the room state, and its events are reported to the room | Rendered and follows the room state too (`applyPlaybackState` has no `isLeader` check), but its reports are dropped |

`useSmartSync` (`hooks/useSmartSync.ts`) only changes `current_time`, and only for a follower whose room state says `play_state === "playing"`. If the last report arrived `SYNC_THRESHOLD_SECONDS` (2.0) or more seconds ago, it adds the elapsed time to `current_time`. A `TICK_MS` (1000) interval re-runs that calculation. Everything else (entry, play_state, version) is passed through as the server sent it. For the leader it returns the state unchanged.

### File map: `pages/player/`

| File | What it is |
| --- | --- |
| `context.ts` | Types `AppState`, `OSDState`, `ScoringSession`, `PlayerContextType`. Creates `PlayerContext` and the `usePlayerState()` hook |
| `PlayerStateProvider.tsx` | `PlayerStateProviderInternal`. Derives `appState`, owns `scoring`, and holds the effects that start songs, end songs, run scoring and roll over to the next song |
| `VideoPlayer.tsx` | `VideoPlayerComponent`. The `<video>` element, applying the room's play state to it, reporting what it does back, stall and dead-URL recovery, the "Now Loading" and "Disc Error" panels |
| `screens/AwaitingInteractionStateScreen.tsx` | "Sound Check" screen with the Allow Sound button |
| `screens/ConnectedStateScreen.tsx` | "Connect a Controller" screen with a QR code and the controller URL |
| `screens/ReadyStateScreen.tsx` | "Select a Song" or "Ready to Start" screen with the room id and reserved count |
| `screens/PlayingStateContent.tsx` | The playing screen: resolves the video URL, renders `VideoPlayerComponent`, the `NowPlayingBanner`, announcements and the held `UpNextCard` |
| `screens/ScoringStateScreen.tsx` | Wraps the `ScoreScreen` organism with the score for the current `scoring` session |
| `screens/ReactionLayer.tsx` | Full-screen `ReactionOverlay` fed by `lastReaction` |
| `screens/StatusStrip.tsx` | Bottom-left strip: offline marker, room id, screen nickname, controller count, autoplay-off marker |

Files outside that folder that the player depends on:

| File | Role |
| --- | --- |
| `pages/PlayerPage.tsx` | Route component. Verifies and joins the room, mounts the providers, picks the screen in `PlayerPageContent` |
| `hooks/useRoom.ts` | Room state and actions (`playNext`, `updatePlayerState`, `publishScore`, and so on). Turns incoming WebSocket messages into state |
| `hooks/useWebSocket.ts` | The socket: handshake, `join_room`, `sendCommand`, `sendCommandWithAck`, reconnects |
| `hooks/useSmartSync.ts` | Follower clock prediction (above) |
| `hooks/useVideoUrlWithRetry.ts` | Fetches a video URL for an entry that has none, with retries |
| `lib/scoring.ts` | `performanceIdOf`, `landingMs`, `scoreFromPerformance`, `rollScore` |

### How `PlayerPage` is put together

`PlayerPage` (default export in `pages/PlayerPage.tsx`) runs these checks in order before the player exists:

1. No `room` search param: redirect to `/`.
2. `room.isVerifying`: "Connecting" message.
3. `room.verificationError`: a password prompt if `room.requiresPassword`, otherwise "Access Denied".
4. `!room.isVerified || !room.hasJoinedRoom`: "Loading" or "Joining Room".
5. Otherwise: `RoomProvider` (shares the `useRoom` result), then `PlayerStateProviderInternal`, then `PlayerPageContent` plus `ReactionLayer` and `StatusStrip`.

`verifyAndJoinRoom(roomId)` is called once on mount from a `useEffect` with an empty dependency array.

Two contexts are in play. `useRoomContext()` (from `providers/RoomProvider`) gives the raw room data and actions. `usePlayerState()` (from `pages/player/context.ts`) gives what the provider derives: `appState`, `hasInteracted`, `setHasInteracted`, `playerState`, `scoring`, `finishSong`, `osd`, `setOSD`.

## 2. Screens and AppState

`AppState` in `pages/player/context.ts` has six values. `PlayerStateProviderInternal` computes it with one `useMemo`, checking in this order (the first match wins):

| Order | Condition | `appState` | Screen rendered by `PlayerPageContent` |
| --- | --- | --- | --- |
| 1 | `!hasInteracted` | `"awaiting-interaction"` | `AwaitingInteractionStateScreen` |
| 2 | `!connected` | `"connecting"` | No dedicated screen. The `default` branch renders `SystemMessage` with the title "Connecting" |
| 3 | `scoring` is not null | `"scoring"` | `ScoringStateScreen` |
| 4 | `playerState?.entry` is set | `"playing"` | `PlayingStateContent` |
| 5 | `controllerCount > 0` | `"ready"` | `ReadyStateScreen` |
| 6 | otherwise (no controllers) | `"connected"` | `ConnectedStateScreen` |

Notes:

- In the `appState` memo, `connected` is the WebSocket connection flag from `useRoom`. It is not the same thing as the `"connected"` app state, which means "socket is up, no controller is in the room".
- `playerState` in the memo is the `useSmartSync` output, not the raw state.
- `"playing"` covers every `play_state` as long as an entry exists. A finished song that is being held (autoplay off, or the score screen already closed) still shows `PlayingStateContent`, with the banner status "Finished".
- `ReactionLayer` and `StatusStrip` are rendered next to `PlayerPageContent` in every app state.

### What moves the player between screens

| From | To | Cause |
| --- | --- | --- |
| `awaiting-interaction` | any later state | The Allow Sound button calls `setHasInteracted(true)`. Nothing else in the codebase sets `hasInteracted`, and it never goes back to `false` |
| any | `connecting` | The WebSocket drops. `useRoom` also clears its room state when `ws.connected` is false, and rejoins the room once it reconnects |
| `connected` | `ready` | `controllerCount` goes above 0 (from `client_count` messages) |
| `ready` | `playing` | `playerState.entry` becomes set, normally because a `play_next` the leader sent made the server broadcast a new `player_state` |
| `playing` | `scoring` | `beginScoring` sets `scoring` (section 3, steps 6 to 8) |
| `scoring` | `playing` | `setScoring(null)` while `playerState.entry` is still set. This happens when the next song did not start, for example autoplay held it |
| `scoring` | `playing` (next song) or `ready`/`connected` (nothing next) | `setScoring(null)` together with the server's broadcast of the next `player_state` |
| `playing` | `ready`/`connected` | The server broadcasts `player_state` with `entry: null` and `play_state: "idle"` |

### The sound-check gate

Browsers block audio until the page has had a user gesture. `AwaitingInteractionStateScreen` shows "Sound Check" and an Allow Sound button. Its `handleInteraction` creates `new Audio()`, calls `.play()` and ignores the expected rejection (the comment in the file says this click enables autoplay for later media elements), then calls `setHasInteracted(true)`.

Because `hasInteracted` is the first check in the `appState` memo, no other screen shows before the click. The room is already joined by then (`PlayerPage` waits for `hasJoinedRoom` before mounting the provider), so room state keeps arriving. The effects in `PlayerStateProvider.tsx` do not look at `hasInteracted`, so they also run behind the Sound Check screen. The `<video>` element only mounts inside `PlayingStateContent`, which only renders after the gate.

## 3. The life of a song

The walkthrough follows one song from "reserved while idle" to the next song or back to idle. Each step names the effect or callback in `PlayerStateProvider.tsx` (effects are identified by their number in the table in [section 4c](#4c-effects-in-playerstateprovidertsx-in-source-order)), the refs involved, and the WebSocket traffic.

The scoring steps need one idea first: a "performance" is one reservation, not one song. `performanceIdOf(state)` in `lib/scoring.ts` returns `state.item_id ?? state.entry.id`, or `null` when there is no entry. The room stamps `item_id` on every player state (`Room.update_player_state` in `backend/core/room.py`). In the provider, `currentItemId = performanceIdOf(playerState)`.

### Step 1: A song is reserved while the room is idle

1. A controller sends `queue_song`. `ControllerCommands.queue_song` adds it to the room queue and calls `_broadcast_room_state()`. It does not start playback (the comment there says the leader asks).
2. The server broadcasts `queue_update` to everyone and `player_state` to the displays if the room has one. It also starts prefetching video URLs for the first two queue items (`_prefetch_video_urls`), and broadcasts again when one is found.
3. In `useRoom`, the `queue_update` case stores the queue if its `version` is newer (or the same version with a newer `timestamp`). The provider derives `reservedCount = upNextQueue?.items.length ?? 0` and `cuedItem = upNextQueue?.items[0] ?? null`.
4. The screen shows `ReadyStateScreen` with the reserved count. If `autoplay` is off and something is reserved it reads "Ready to Start" and "Press Play on the controller."

### Step 2: Cueing (asking for the song)

Effect 2 (the "start the queue" effect) runs on the leader when all of these hold: `isLeader`, `autoplay`, no `currentItemId`, `reservedCount > 0`, and the `starting` ref is false.

- It sets `starting.current = true` and calls `playNextRef.current({})`.
- The WebSocket command sent is `play_next` with `{ from_item_id: null, request_id }` (`playNext` in `useRoom.ts` uses `sendCommandWithAck`).
- `starting.current` goes back to `false` in `.finally`.

On the server, `ClientCommands.play_next` in `backend/commands.py`:

1. If `from_item_id` is set and differs from the current `player_state.item_id`, it returns `{"advanced": false, "stale": true}` and does nothing else.
2. Otherwise `Room.play_next()` pops the first queue item and sets `current_item_id`, `current_singer`, `current_singer_device_id`. With an empty queue it clears those instead.
3. It builds a `DisplayPlayerState` with `play_state: "playing"` (or `"idle"` and `entry: None` if nothing was popped), `current_time: 0.0`, and calls `_update_player_state`. That stamps `item_id` and `singer`, broadcasts `player_state` to the whole room, and, if `item_id` changed, sends each controller a `scoring_turn` message.
4. It calls `_broadcast_room_state()` (queue update, player state to displays, prefetch) and returns `{"advanced": bool}`.

If autoplay is off, effect 2 never fires. The start comes from a controller's Play: the server forwards `play_song` to the displays (`_toggle_playback_state`), `useRoom` stores `playbackRequest = { state: "playing", at }`, and effect 9 (the `playbackRequest` effect) handles it. With no current entry and something reserved (`wantsSound`), the leader calls `playNextRef.current({})`. A display that is not the leader only marks the request handled. `handledPlayback` stores `playbackRequest.at` so a re-render cannot act on one request twice.

### Step 3: Loading the video URL

When the new `player_state` arrives, `playerState.entry` is set, `appState` becomes `"playing"`, and `PlayingStateContent` mounts.

- It calls `useVideoUrlWithRetry(entry)` only when `playerState.entry` exists and has no `video_url`; otherwise it passes `null`.
- It then computes `videoUrl`: `playerState.entry.video_url` first, then the hook's result, else `null`.
- It passes `isLoadingVideoUrl={videoUrl ? false : isLoadingVideoUrl}` to `VideoPlayerComponent`.

`VideoPlayerComponent` renders by priority:

1. `isLoadingVideoUrl && !streamFailed`: a "Now Loading" panel with the song title.
2. `!videoUrl || streamFailed`: a "Disc Error" panel (section 5). If there is no entry it renders nothing.
3. Otherwise: the `<video>` element.

Prefetching helps skip the wait. The server prefetches URLs for the first two queued songs, and `handleNearingEnd` in `PlayingStateContent` calls `triggerVideoUrl(nextSong.entry)` when 15 seconds or less remain (see step 5).

### Step 4: Playing

The `<video>` element has `key={performanceIdOf(playerState) ?? undefined}`, so a new performance gets a new element. It has no `autoPlay` attribute. A comment explains why: a remount that started itself brought back a song the room had just finished.

What starts and stops it is `applyPlaybackState(video)`, which reads `playerStateRef.current`:

| Room `play_state` | What `applyPlaybackState` does |
| --- | --- |
| `finished`, `error`, `idle` | Pauses the video if it is playing, and returns |
| `paused` | Seeks forward if the room's `current_time` is more than 2 seconds ahead of the element (it never seeks backwards), then pauses |
| `playing`, `buffering` | Same forward-only seek, then calls `video.play()` if paused. An `AbortError` is ignored, other failures are logged |

It is called from three places: the effect keyed on `videoUrl`, entry id, `play_state` and `current_time`; the `onCanPlay` handler; and the `onCanPlayThrough` handler. A separate effect keyed on `videoUrl` calls `video.load()` once per URL, tracked in `loadedUrlRef`, so a replacement URL for the same song reaches the same element.

Reporting back (the leader only has an effect, since followers' reports are dropped in `updatePlayerState`):

| Source | Reports |
| --- | --- |
| `onPlay` | `play_state: "playing"` with `current_time`, `duration`, `volume` |
| `onPause` | `play_state: "paused"` |
| `onWaiting` | `play_state: "buffering"`, once, guarded by `isBufferingRef` |
| `onCanPlay` | If the room state is `buffering`, reports `"playing"`; clears `isBufferingRef`; then `applyPlaybackState` |
| 1000 ms interval effect | While `play_state` is `"playing"`, reports `"playing"` with the element's `currentTime` if the element is not paused or ended |
| `beforeunload` handler | `"paused"` or `"playing"` from the element, so a reload keeps the position |

All reports go through `updateVersionedPlayerState`, which:

- drops the report if its entry id differs from the current entry id ("a song the room has left behind");
- drops it if the room is `finished` and the report is not `finished`;
- otherwise sends `updatePlayerState({...defaults, ...partialState, entry, item_id: current?.item_id ?? null, version: Date.now(), timestamp: Date.now()})`.

The WebSocket command is `update_player_state`. The server (`DisplayCommands.update_player_state`) ignores it if the sender is not the leader, if it names a different `item_id` than the one on air, or if it would move a `finished` turn to another state. Otherwise it stamps a new version and broadcasts `player_state` to the room.

Play, pause and volume from a controller follow the same pattern. The controller sends `play_song`, `pause_song` or `set_volume`; the server forwards them to the displays; the leader changes the state. Specifically:

- Effect 9 (`playbackRequest`) calls `updatePlayerStateRef.current({...current, play_state: playbackRequest.state, ...})`. It does nothing if the state already matches, if the turn is `finished` (it may call `play_next` instead, see step 10), or if it is `error`.
- Effect 13 (`lastQueueCommand`) handles `set_volume`: it calls `updatePlayerState` with the new volume and shows a volume OSD for 2000 ms. Note this effect runs on every display and uses `updatePlayerState`, which only sends from the leader.

### Step 5: Announcing the next song

In `PlayingStateContent`, `handleNearingEnd` is called once per song by `VideoPlayerComponent`'s `timeupdate` listener when `video.duration - video.currentTime` is above 0 and at most 15 seconds. `hasNearingEndFiredRef` ensures it fires once, and an effect resets it when `playerState?.entry?.id` changes. If the queue has an item, it:

- sets the "Up Next" banner for the remaining time, only if `autoplay` is on;
- prefetches the next entry's URL with `triggerVideoUrl` unless that entry already has a `video_url`.

A separate effect shows a "Reserved" banner for 3000 ms when the queue grows.

### Step 6: The song ends, or is skipped

There are two ways in, and both end up in `endSong(itemId, playedSeconds, quick)`.

**It ends by itself.** The `<video>` `onEnded` handler (in `VideoPlayer.tsx`) returns early if there is no entry or the room is already `finished`. Otherwise it:

1. sends `updateVersionedPlayerState` with `play_state: "finished"` and the element's `currentTime` (an `update_player_state` command);
2. calls `onSongEnded(video.currentTime || 0)`, which `PlayingStateContent` wires to `finishSong(performanceIdOf(playerState)!, playedSeconds)`.

`finishSong` calls `endSong(itemId, playedSeconds, false)`. Every display runs this, because every display's video element can end, so a follower also begins its own scoring session. Only the leader's commands have any effect (the gating in `useRoom.ts` described in section 1).

**A controller presses Next.** The controller sends `skip_song`. `ControllerCommands.skip_song` forwards `skip_request` to the displays and returns `{"screens": n}`. `useRoom` stores `skipRequest = { at: Date.now() }`. Effect 7 (the `skipRequest` effect) then:

1. Marks the request handled with `handledSkip.current = skipRequest.at`, and stops if the display is not the leader.
2. Reads `playerStateRef.current` and its `performanceIdOf`. Stops if there is no entry.
3. If the room is already `finished`:
   - with no `scoringRef.current`, `autoplayRef.current` false and a `cuedItemRef.current`, it calls `removeSongRef.current(cued.id)` (command `remove_song` with `{entry_id: cued.id}`, which the server accepts from the leader display) and returns. The comment says this drops the held song so the one behind it becomes cued;
   - otherwise it calls `playNextRef.current({ fromItemId: itemId })` and returns.
4. If the room is anything else, it sends `updatePlayerStateRef.current({...current, play_state: "finished", skipped: true, ...})` and calls `endSong(itemId, current.current_time, true)`. The `true` is `quick`. `skipped` is how the followers learn the same thing (see "Followers do not rely on their own video event" below).

### Step 7: `endSong`: score it or skip scoring

`endSong` first checks `performanceIdOf(playerStateRef.current) === itemId` and returns if not (the room moved on).

- If `playedSeconds < minScoredRef.current`, the song was too short to score. A `quick` end calls `playNextRef.current({ fromItemId: itemId })` directly. A normal end calls `rollOver(itemId)`. No scoring screen appears.
- Otherwise it calls `beginScoring(itemId, quick)`.

`minScoredRef` mirrors `minScoredSeconds` from `useRoom`, which comes from the server's `room_settings` message (`min_scored_seconds`, `MIN_SCORED_SECONDS = 5.0` in `backend/core/room.py`). `useRoom` falls back to `DEFAULT_MIN_SCORED_SECONDS = 5` until settings arrive.

`rollOver(itemId)` is where autoplay is enforced on the client. The server never checks it for `play_next`. It returns `null` (hold) when `!autoplayRef.current && reservedCountRef.current > 0`. Otherwise it returns `Promise.resolve(playNextRef.current({ fromItemId: itemId }))`. With nothing reserved, it proceeds even when autoplay is off, so the room clears to idle.

Followers do not rely on their own video event. Effect 8 ("followers read the decision") runs when `playState === "finished"`, there is a `currentItemId`, `scoring` is null, `scoredItem.current !== currentItemId`, and the state's `current_time` is at least `minScoredSeconds`. It then calls `beginScoring(currentItemId, Boolean(current.skipped))`, so a follower runs the quick reveal on a skip, the same as the leader. Because `beginScoring` skips an item already in `scoredItem`, the leader (and any display whose own `endSong` ran first) does not start a second session.

`skipped` is kept by the room (`Room.update_player_state` in `backend/core/room.py`). It is forced to `false` on any state other than `finished`. Once a turn is `finished`, a later `finished` report for the same turn keeps the first one's value, so how a turn ended cannot change after it ends.

### Step 8: Scoring starts (`beginScoring`)

`beginScoring(itemId, quick)` returns early if `scoredItem.current === itemId || advancing.current`. Otherwise it:

1. builds `session = { itemId, quick }`;
2. sets `scoredItem.current = itemId` (a turn is scored once) and `scoringRef.current = session`;
3. calls `setScoring(session)`, which makes `appState` become `"scoring"` and shows `ScoringStateScreen`;
4. calls `finishScoring(quick, SCORE_WAIT_MAX_MS)` as a fallback timer (6000 ms), "replaced by the reveal when one arrives".

Effect 4 (announce scoring) runs on the leader when `Boolean(scoring)` differs from `announced.current`. It sets `announced.current` and calls `announceScoringRef.current(active)`, which sends `scoring_state` with `{active}`. The server forwards it to controllers only (`broadcast_to_room_controllers`), because remotes cannot see the scoring screen.

### Step 9: The score: mic reading or generated

The leader is the jury, so the whole room sees one number. Effect 5 (the jury effect) runs when `isLeader`, `scoring`, `scoreReading` or `judged` changes, and does nothing unless the display is the leader, `scoring` is set, and `judged` is false. `judged` is not a ref: it is derived on each render as `score?.item_id === scoring.itemId`, so it reads the room's score rather than anything this display remembers.

Where a mic reading comes from:

1. The singer's phone sends `submit_score` with `{item_id, performance}` (`submitScore` in `useRoom.ts`, where `performance` is a number from 0 to 1 per `backend/README.md`).
2. `ControllerCommands.submit_score` drops it unless: the client is within the rate limit (`SCORE_RATE_LIMIT = 4` per `SCORE_RATE_WINDOW = 10.0` seconds), `client.device_id` equals `room.current_singer_device_id`, `item_id` matches `player_state.item_id`, and `player_state.current_time >= MIN_SCORED_SECONDS`.
3. If accepted, the server sends `score_reading` with `{item_id, performance}` to the displays.
4. `useRoom` stores it as `scoreReading = { itemId, performance, at }` (displays only).

What the jury effect does with it:

- `heard` is `scoreReading` if `scoreReading.itemId === scoring.itemId`, else `null`.
- `publish()` calls `publishScoreRef.current(itemId, score, source)`:
  - with a reading: `scoreFromPerformance(heard.performance)` and source `"mic"`;
  - without: `rollScore()` and source `"auto"`.
- If a reading is already in hand, `publish()` runs immediately.
- If not, it waits `JURY_GRACE_MS` (1000 ms) in a timer. If a reading arrives during that second, the effect re-runs (its cleanup clears the timer) and publishes the mic score right away.

The command sent is `publish_score` with `{item_id, score, source}`. The server (`DisplayCommands.publish_score`) accepts it only from the leader, only for the turn on air (`room.current_item_id`), and only once per turn. It stores the score on the room (`Room.record_score`), broadcasts `score` with `{item_id, score, source, timestamp}` to the whole room, and acks `{published: true}`. Anything else acks `{published: false}` and broadcasts nothing. `Room.play_next` clears the stored score, and `join_room` sends it to a client that joins while it is set.

The room's copy is the only record of whether a turn is scored. A second `publish()` for the same turn, for example a mic reading arriving after the grace timer already published, is refused by the server rather than guarded against on the display.

### Step 10: The reveal, then rolling over

`useRoom` stores the `score` message as `score`. Two things react:

- `ScoringStateScreen` passes `score.score` to the `ScoreScreen` organism only if `score.item_id === scoring.itemId`. Until then it passes `null`, and `ScoreScreen` shows its processing state. It passes `quick={scoring?.quick ?? false}` and `sound={!scoring?.quick}`.
- Effect 6 (score arrival) runs when `scoring` and `score` match by item id. It calls `finishScoring(scoring.quick, landingMs(scoring.quick) + hold)`, where `hold` is `SKIP_REVEAL_HOLD_MS` (2000) for a quick session and `REVEAL_HOLD_MS` (4000) otherwise. `landingMs` is `QUICK_LANDING_MS` (600) or `LANDING_MS` (1500) from `lib/scoring.ts`. So the screen stays for 600 + 2000 = 2600 ms after the score arrives for a skip, and 1500 + 4000 = 5500 ms for a normal end. The comment says timing from arrival is used so the result does not depend on an animation callback that reduced motion skips.

`finishScoring(quick, delay)`:

1. Returns if `advancing.current` is true.
2. Calls `clearScoreTimer()` and starts a new `window.setTimeout` stored in `scoreTimer.current`. This is what replaces the 6000 ms fallback.
3. When the timer fires, it reads `scoringRef.current`. It stops if there is no session or `advancing.current` is true.
4. It picks the advance: for `quick` it calls `playNextRef.current({ fromItemId: session.itemId })` (a skip advances whatever autoplay says, because someone asked); otherwise `rollOver(session.itemId)`.
5. If `rollOver` returned `null` (held), it calls `setScoring(null)` and stops. The room stays on the finished song.
6. Otherwise it sets `advancing.current = true`, and in `.finally` sets it back to `false` and calls `setScoring(null)`. The comment says the screen is held until the room has moved on, so the finished song does not come back on air during the round trip.

The `play_next` command carries `from_item_id`, which the server compares with the current `item_id` (step 2). A timer that fires after a remote already advanced is ignored.

### Step 11: The next song, or back to idle

The server's response to `play_next` is a new `player_state` for the next reservation (`play_state: "playing"`, new `item_id`), or `entry: null` with `play_state: "idle"` if the queue was empty.

When `currentItemId` changes, effect 10 (the reset effect) runs and clears the per-performance state: `scoringRef.current = null`, `advancing.current = false`, `scoredItem.current = null`, `setScoring(null)`, `clearScoreTimer()`. This also runs once on mount.

Then:

- Next song: back to step 3. `PlayingStateContent` stays mounted, and the `<video>` remounts because its `key` changed.
- Nothing next: `playerState.entry` is `null`, so `appState` is `"ready"` or `"connected"`.

Effect 4 sends `scoring_state` with `{active: false}` when `scoring` clears on the leader.

### What autoplay off changes

`autoplay` comes from `room_settings` (default `true` in `useRoom` until settings arrive). A controller changes it with `set_autoplay` (`setAutoplay` in `useRoom.ts` updates local settings optimistically and restores them if the command fails). `Room.set_autoplay` bumps `settings_version` and the server broadcasts `room_settings` only when the value changed.

With autoplay off, in the display code:

| Place | Change |
| --- | --- |
| Effect 2 (start the queue) | Does not run. A cold room waits for a Play (effect 9) |
| `rollOver` | Returns `null` while something is reserved, so no `play_next` is sent after a song ends |
| `finishScoring` | A normal end calls `setScoring(null)` and leaves the room on the finished song |
| Effect 3 (rollover watchdog) | Does not arm (it requires `autoplay`) |
| Effect 9 (`playbackRequest`) | On a `finished` turn, Play calls `play_next` with `fromItemId` if something is reserved (`wantsSound`) |
| Effect 7 (`skipRequest`) | On a `finished` turn with nothing scoring, Next removes the cued song instead of advancing |
| `PlayingStateContent` | `heldSong` shows an `UpNextCard` over the video when `play_state === "finished"` |
| `handleNearingEnd` | Does not show the "Up Next" banner, but still prefetches |
| `ReadyStateScreen` | Shows "Ready to Start" and "Press Play on the controller." when songs are reserved |
| `StatusStrip` | Shows "Autoplay Off" |

A skip (`quick`) still advances with autoplay off.

## 4. Reference tables

### 4a. Timing constants

| Constant | Value | File | What it bounds |
| --- | --- | --- | --- |
| `REVEAL_HOLD_MS` | 4000 | `PlayerStateProvider.tsx` | How long the score stays after it lands, for a normal end (added to `landingMs(false)`) |
| `SKIP_REVEAL_HOLD_MS` | 2000 | `PlayerStateProvider.tsx` | The same, for a skipped song (added to `landingMs(true)`) |
| `SCORE_WAIT_MAX_MS` | 6000 | `PlayerStateProvider.tsx` | Fallback timer started by `beginScoring`: how long to wait for a score before moving on |
| `JURY_GRACE_MS` | 1000 | `PlayerStateProvider.tsx` | How long the leader waits for a mic reading before publishing a generated score |
| `ROLLOVER_WATCHDOG_MS` | 12000 | `PlayerStateProvider.tsx` | How long a finished song may sit on the leader before the watchdog asks for the next song |
| `LANDING_MS` | 1500 | `lib/scoring.ts` | How long the score digits take to settle on a normal reveal (read via `landingMs(false)`) |
| `QUICK_LANDING_MS` | 600 | `lib/scoring.ts` | The same for a skip (read via `landingMs(true)`) |
| `RECOVERY_ATTEMPTS` | 2 | `VideoPlayer.tsx` | Number of times `recoverPlayback` re-resolves a stream URL for one entry before it reports `error` |
| `STALL_TIMEOUT_MS` | 25000 | `VideoPlayer.tsx` | How long the room state may stay `buffering` before `recoverPlayback` runs |
| `SYNC_THRESHOLD_SECONDS` | 2.0 | `hooks/useSmartSync.ts` | A follower predicts `current_time` only once the last report is at least this old |
| `TICK_MS` | 1000 | `hooks/useSmartSync.ts` | How often a follower re-runs the prediction |
| `DEFAULT_MIN_SCORED_SECONDS` | 5 | `hooks/useRoom.ts` | Minimum played seconds for a score, until `room_settings` supplies `min_scored_seconds` |
| `MIN_SCORED_SECONDS` | 5.0 | `backend/core/room.py` | Same rule on the server; published as `min_scored_seconds` and enforced in `submit_score` |

Inline numbers without a name:

| Value | Where | What it is |
| --- | --- | --- |
| 1000 ms | `VideoPlayer.tsx`, `setInterval` in the periodic report effect | Report interval while playing |
| 15 s | `VideoPlayer.tsx`, `handleTimeUpdate` | Time remaining at which `onNearingEnd` fires |
| 2 s | `VideoPlayer.tsx`, `applyPlaybackState` | The room must be more than this far ahead of the element before it seeks |
| 2000 ms | `PlayerStateProvider.tsx` | "Play" OSD and volume OSD duration |
| 3000 ms | `PlayingStateContent.tsx` | How long the "Reserved" banner shows |
| 10000 ms | `useWebSocket.ts`, `sendCommandWithAck` default `timeout` | How long an acknowledged command waits for its `ack` |
| 5000 ms | `useVideoUrlWithRetry.ts` | Delay before the automatic URL retry. It only arms while `manualRetryCount < 2`, and it calls `retry()`, which increments `manualRetryCount` |
| 3 | `useVideoUrlWithRetry.ts`, `canRetry` | Maximum manual retries (the "Retry n/3" text in `VideoPlayer.tsx`) |

### 4b. Refs

#### `PlayerStateProvider.tsx` (21 refs)

**Guards that stop double actions**

| Ref | Guards or holds |
| --- | --- |
| `starting` | A `play_next({})` from effect 2 is in flight, so it is not sent twice |
| `recovering` | A watchdog `play_next` (effect 3) is in flight. Also blocks the watchdog from arming |
| `advancing` | An advance after scoring is in flight. Stops `finishScoring` and `beginScoring` from acting during the round trip |
| `scoredItem` | The performance id that already has a scoring session, so a turn is scored once |
| `announced` | The last `scoring_state` value sent (`true`, `false`, or `null` before the first), so it is only sent on change |

**Timers**

| Ref | Guards or holds |
| --- | --- |
| `scoreTimer` | The id of the single pending `finishScoring` timeout, or `null`. `clearScoreTimer` clears it |

**"Latest value" mirrors, copied in effect 1 and read inside timers and one-shot effects**

| Ref | Mirrors |
| --- | --- |
| `publishScoreRef` | `publishScore` from `useRoom` |
| `announceScoringRef` | `announceScoring` |
| `playNextRef` | `playNext` |
| `removeSongRef` | `removeSong` |
| `updatePlayerStateRef` | `updatePlayerState` |
| `playerStateRef` | The (smart-synced) `playerState` |
| `scoringRef` | The `scoring` state. Also written directly by `beginScoring` and the reset effect, ahead of the state update |
| `autoplayRef` | `autoplay` |
| `minScoredRef` | `minScoredSeconds` |
| `reservedCountRef` | `reservedCount` |
| `cuedItemRef` | `cuedItem` (the first queue item) |

**Handled-event markers**

| Ref | Guards or holds |
| --- | --- |
| `handledSkip` | The `at` of the last `skipRequest` acted on |
| `handledPlayback` | The `at` of the last `playbackRequest` acted on |
| `lastPlayStateRef` | The last `play_state` the OSD effect (12) reacted to |

The comment above the mirrors (`useRoom hands back fresh closures every render`) explains why they exist: `useRoom` returns new action functions on every render, so timers and one-shot effects read them through refs instead of re-running on every render.

#### `VideoPlayer.tsx` (7 refs)

| Ref | Role | Guards or holds |
| --- | --- | --- |
| `videoRef` | DOM handle | The `<video>` element |
| `playerStateRef` | Latest-value mirror | `playerState`, kept by an effect, read by media event handlers and the interval |
| `isBufferingRef` | Guard | A `buffering` report was already sent, so `onWaiting` reports once until `onCanPlay` or `onError` clears it |
| `hasNearingEndFiredRef` | Guard | `onNearingEnd` already fired for this song. Reset when the entry id changes |
| `recoveringRef` | Guard | A `refreshVideoUrl` call is in flight, so `recoverPlayback` does not stack |
| `attemptsRef` | Counter | `{ entryId, count }`: recovery attempts used for the current entry |
| `loadedUrlRef` | Guard | The URL already passed to `video.load()` |

### 4c. Effects in `PlayerStateProvider.tsx` in source order

"Runs when" lists the dependency array. Line numbers are as of this writing and will drift.

| # | Line | Runs when | What it does |
| --- | --- | --- | --- |
| 1 | 91 | `publishScore`, `announceScoring`, `playNext`, `removeSong`, `updatePlayerState`, `playerState`, `scoring`, `autoplay`, `minScoredSeconds`, `reservedCount`, `cuedItem` change | Copies each into its mirror ref (`publishScoreRef` ... `cuedItemRef`, `scoringRef`) |
| 2 | 131 | `isLeader`, `autoplay`, `currentItemId`, `reservedCount` change | Leader with autoplay on, nothing on air and something reserved: sends `play_next` `{}` guarded by `starting` |
| 3 | 147 | `isLeader`, `currentItemId`, `playState`, `autoplay`, `scoring` change | Rollover watchdog. If the leader has a `finished` song, autoplay on, no scoring and `recovering` false, arms a `ROLLOVER_WATCHDOG_MS` timer. When it fires it re-reads `scoringRef` and `playerStateRef`, and if still finished sends `play_next` with `fromItemId: currentItemId` |
| 4 | 178 | `scoring`, `isLeader` change | Leader sends `scoring_state` `{active}` when `Boolean(scoring)` differs from `announced.current` |
| 5 | 190 | `isLeader`, `scoring`, `scoreReading`, `judged` change | The jury. Leader publishes a score unless the room already has one for the performance, using the mic reading if present, else after `JURY_GRACE_MS` a generated one |
| 6 | 272 | `scoring`, `score`, `finishScoring` change | When the `score` matches the scoring session, replaces the fallback timer with `finishScoring(quick, landingMs(quick) + hold)` |
| 7 | 308 | `skipRequest`, `isLeader`, `endSong` change | Handles a remote's Next (leader only, once per `at`) |
| 8 | 351 | `playState`, `currentItemId`, `scoring`, `minScoredSeconds`, `beginScoring` change | On any display, when the room state is `finished`, not yet scored and long enough, calls `beginScoring(currentItemId, Boolean(current.skipped))` |
| 9 | 363 | `playbackRequest` changes | Handles a remote's Play or Pause (leader only, once per `at`) |
| 10 | 396 | `currentItemId`, `clearScoreTimer` change | Resets the per-performance refs and state when the performance changes |
| 11 | 404 | `clearScoreTimer` (effectively mount) | Cleanup on unmount: clears `scoreTimer` |
| 12 | 410 | `playerState?.play_state`, `playerState?.entry`, `setOSD` change | Sets the on-screen label for `play_state` changes ("Play" for 2000 ms, "Pause", "Buffering"), tracked with `lastPlayStateRef` |
| 13 | 431 | `lastQueueCommand` changes | For `set_volume`: sends the new volume through `updatePlayerState` and shows a volume OSD for 2000 ms |

#### Effects in `VideoPlayer.tsx` in source order

| # | Line | Runs when | What it does |
| --- | --- | --- | --- |
| V1 | 49 | `playerState` changes | Copies it to `playerStateRef` |
| V2 | 121 | `videoUrl` changes | Calls `video.load()` once per URL (`loadedUrlRef`) |
| V3 | 131 | `videoUrl`, entry id, `play_state`, `current_time` change | Calls `applyPlaybackState` |
| V4 | 189 | `play_state`, entry id, `recoverPlayback` change | While `buffering`, starts a `STALL_TIMEOUT_MS` timer that calls `recoverPlayback()` |
| V5 | 197 | `playerState?.volume` changes | Sets `video.volume` |
| V6 | 206 | entry id, `play_state`, `updateVersionedPlayerState` change | While `playing`, 1000 ms interval that reports the element's time |
| V7 | 234 | `playerState?.entry`, `onNearingEnd` change | Adds the `timeupdate` listener that fires `onNearingEnd` at 15 s or less remaining |
| V8 | 255 | entry id changes | Resets `hasNearingEndFiredRef` |
| V9 | 260 | `playerState?.entry` changes | Adds the `beforeunload` listener that reports the element's state |

## 5. Failure handling

### Stalls

When the room's `play_state` is `buffering`, effect V4 starts a `STALL_TIMEOUT_MS` (25000 ms) timer. If it fires, it calls `recoverPlayback()`. The timer is cleared when `play_state` or the entry changes. `recoverPlayback` returns early unless this display is the leader.

### Dead or expired video URLs

The comment on `RECOVERY_ATTEMPTS` says provider URLs expire mid-song. Two things trigger `recoverPlayback`: the `<video>` `onError`, and the stall timer.

`recoverPlayback(fresh = false)`:

1. Returns if there is no entry, `recoveringRef.current` is true, or this display is not the leader.
2. Resets `attemptsRef` to `{ entryId: entry.id, count: 0 }` if `fresh` is true or the entry id changed.
3. If `count >= RECOVERY_ATTEMPTS`, gives up (below).
4. Otherwise increments `count`, sets `recoveringRef`, and calls `refreshVideoUrl(entry.id)`, which sends `refresh_video_url` with `{entry_id}`.
5. On the server (`DisplayCommands.refresh_video_url`), leader only: if the entry on air matches, it calls `service.get_video_url(entry, refresh=True)`, stores the new `video_url` on the entry, then updates the room with `play_state: "buffering"` and the same time, duration and volume. It returns `{"refreshed": true}`. It returns `{"refreshed": false}` if the sender is not the leader, the entry does not match, or no URL was found.
6. The new `player_state` reaches every display with the new `entry.video_url`. `PlayingStateContent` picks it up (`playerState.entry.video_url` wins), and effect V2 calls `video.load()` for the new URL.
7. If the ack says `refreshed: false`, or the command rejects (for example by timing out), `giveUp()` runs.

`giveUp()` reports `play_state: "error"` through `updateVersionedPlayerState`. Every display then has `streamFailed = playerState?.play_state === "error"` and shows the "Disc Error" panel: "The stream from <source> stopped responding". On the leader, a Retry button calls `recoverPlayback(true)`, which resets the attempt count. Pressing Next on a controller moves on: effect 7 sees a non-`finished` state and ends the song like any skip.

A different case is a URL that never resolved. `useVideoUrlWithRetry` retries once automatically after 5000 ms when `swrError` is set, there is no data, and `manualRetryCount < 2`; the Retry button on the panel calls `retry` (up to 3 manual retries, shown as "Retry n/3"). After that the panel reads "Out of retries. Pick a different song."

Nothing in the provider treats `error` as a trigger to advance. Effect 9 also ignores Play and Pause while the state is `error` (the comment says an unplayable song is the room's to clear, not a remote's to resume).

### The rollover watchdog

The comment above effect 3 says the ask that ends a finished song is a timer in one screen, so reloading that screen drops the rollover and parks the room on a dead song. Effect 3 reads the situation back off the state instead. On the leader, when the state is `finished`, autoplay is on, nothing is scoring and `recovering.current` is false, it waits `ROLLOVER_WATCHDOG_MS` (12000 ms; the comment says this is longer than any score screen can run). When the timer fires it checks `scoringRef.current` and `playerStateRef.current?.play_state` again. If the song is still finished and no scoring has begun, it logs "Finishing a rollover that was dropped" and sends `play_next` with `fromItemId: currentItemId`. The server ignores it as stale if the room has already moved on.

### Leader changes

The leader can change at any time (`leader_status`). What the code does:

- **Becoming leader mid-song.** `isLeader` turns true, so `updatePlayerState` starts sending. The new leader's `<video>` element was already following the room state, so its `onPlay`, interval and other reports start reaching the server. `useSmartSync` stops predicting for it.
- **Becoming leader mid-scoring.** Effect 4 sends `scoring_state` `{active: true}` because `announced.current` is still `null`. Effect 5 re-arms because `isLeader` is in its dependencies, unless the room's `score` already names the session's item id, in which case the new leader has nothing to publish. The comment says being promoted mid-grace re-arms the jury rather than costing the singer their score. A pending `finishScoring` timer on that display now calls a `playNext` that works, because `playNextRef` is refreshed from the render that knows `isLeader` is true.
- **Becoming leader while a song sits finished.** Effect 3 depends on `isLeader`, so the watchdog arms.
- **Losing leadership.** `playNext` and `updatePlayerState` become no-ops on that display. The grace timer in effect 5 and the timer in effect 3 are cleared by their effect cleanups, because `isLeader` is a dependency. A `finishScoring` timer is not cancelled, and its `play_next` call becomes a no-op.
- **One score per turn across displays.** The room keeps the score it accepted, so a display promoted after the old leader published sees `score` for the item and does not publish. If its `score` has not arrived yet, the server refuses its `publish_score` anyway.
- **Reconnecting.** When `ws.connected` is false, `useRoom` clears its room state (queue, player state, settings, score, requests) and `isLeader` goes to `false`, so the provider shows `"connecting"`. `useWebSocket` reconnects on its own with backoff (0.5 s doubling to a 30 s cap, up to 50 attempts) and sends a `handshake` as the first message on every new socket. When the socket is back, `useRoom` calls `verifyAndJoinRoom` again, which re-verifies over HTTP and sends `join_room`; the server then sends the current state and `leader_status` (`_receive_current_state`). `PlayerPage` keeps the provider mounted through all of this once `room.hasJoinedOnce` is true, so `hasInteracted` and the other local state survive. If the room no longer exists (rooms live in memory, so a backend restart loses them), the re-verify fails and the page shows "Access Denied" with "Room not found".

## 6. Tips for changing this code safely

### Keep these in sync

- **Mirror refs and their state.** Each mirror in section 4b is copied in effect 1 from the state or prop it mirrors. If you add a value a timer or one-shot effect needs, add a `useRef`, add the copy in effect 1, and add the value to that effect's dependency array. Do not read the closure value inside a timer.
- **`scoring` and `scoringRef`.** `beginScoring` and the reset effect write `scoringRef.current` directly, before `setScoring` takes effect. `finishScoring`'s timer reads `scoringRef`, not the state.
- **`scoredItem`, `advancing`, `scoreTimer` and `scoring`.** The reset effect (10) clears them together when `currentItemId` changes. A new per-performance guard belongs in that effect.
- **`announced` and `scoring`.** Effect 4 turns `scoring` into at most one message per change.
- **Guards and `.finally`.** `starting`, `recovering` and `advancing` are reset in `.finally` of the promise they guard. Keep it that way so a rejected command cannot leave one stuck.
- **Handled markers.** `handledSkip` and `handledPlayback` compare against `request.at`. An effect that reads a request from `useRoom` needs the same marker.
- **`playerStateRef` appears twice**, once in the provider (smart-synced state) and once in `VideoPlayer.tsx`. Both come from `usePlayerState().playerState`.
- **The video element and the room state.** `applyPlaybackState` is the one place that starts or stops the element. The report handlers only describe what the element did. `updateVersionedPlayerState` filters reports about another entry and reports that would reopen a `finished` song, and the server filters the same cases (`update_player_state` in `backend/commands.py`). Keep both sides consistent.
- **Entry id versus performance id.** The same song queued twice has one `entry.id` and two performance ids. Scoring guards use `performanceIdOf`. The `refresh_video_url` command uses `entry.id`. `remove_song` takes a queue item id.
- **Client and server share rules.** `min_scored_seconds` comes from the server in `room_settings`. The server enforces it in `submit_score` and the display enforces it in `endSong` and effect 8.

### Testing by hand

Start the backend and frontend as described in the [root README](../../README.md#local-development), then:

**One display and one controller**

1. Create a room on the home page (`/`).
2. Open `/player?room=<id>` in one tab and click Allow Sound. You should see "Connect a Controller".
3. Open `/controller?room=<id>` in another tab or on a phone. The display should change to "Select a Song".
4. Reserve a song. With autoplay on, the leader should send `play_next` and the video should start.
5. Check the cases you changed: Play and Pause from the controller, Next at the start (under 5 seconds, no score screen), Next mid-song (quick score), letting a song end (full score), reserving more than one song, and turning autoplay off in the controller and repeating.

Useful signals in the browser console on the display: `[WebSocket display]` log lines, "Non-leader display ignoring ..." messages, `[Player] Finishing a rollover that was dropped`, and `[Player] Re-resolving a dead stream`. On the backend, `[DEBUG]` lines show ignored stale `play_next` calls and ignored player-state reports.

To exercise the watchdog, reload the leader display while a song is finished and autoplay is on, and wait for `ROLLOVER_WATCHDOG_MS`.

**Two displays (leader and follower)**

1. Open `/player?room=<id>` in two tabs and click Allow Sound in both. The first to join is the leader, which the server decides. Nothing on screen says which one it is, so use the console messages above (the follower logs "Non-leader display ignoring ...") to tell them apart.
2. Reserve a song and watch both. Both should show the same screen. The follower's time may be predicted by `useSmartSync`.
3. Close the leader tab mid-song. The other display is promoted (`leader_status`) and should keep the room moving.
4. Repeat while the score screen is up to check the mid-scoring hand-over.

Note that browsers may throttle timers in background tabs. Put the two displays in separate windows if timing looks wrong.

For pure UI changes to the screens, Storybook (`npm run storybook`) shows components such as `ScoreScreen` without the backend.

# PWA Karaoke Backend

A FastAPI-based WebSocket server for managing karaoke rooms, song queues, and player state synchronization.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Source Providers](#source-providers)
  - [Provider Interface](#provider-interface)
  - [Creating a New Source Provider](#creating-a-new-source-provider)
  - [Ranking Signals](#ranking-signals)
  - [Resolving Video URLs](#resolving-video-urls)
  - [Registration](#registration)
  - [Health](#health)
  - [Built-in Providers](#built-in-providers)
- [HTTP API Endpoints](#http-api-endpoints)
- [WebSocket Protocol](#websocket-protocol)
  - [Connection Flow](#connection-flow)
  - [Client Types](#client-types)
  - [Message Format](#message-format)
  - [Message Processing](#message-processing)
  - [Commands Reference](#commands-reference)
  - [Server-to-Client Messages](#server-to-client-messages)
  - [Data Models](#data-models)
  - [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

Simple, modular architecture for multi-room karaoke with display leadership:

```
FastAPI Server (/ws)
        │
   SessionManager ─── Manages rooms & clients
    │         │
ClientManager  RoomManager
    │         │
Connections   Room State
Heartbeat     Queue & Player
Display       Smart Sync
Leadership    Versioning
```

**Key Components:**
- **SessionManager**: Coordinates everything, handles room-scoped operations and display leadership
- **ClientManager**: WebSocket connections, heartbeat, metrics
- **RoomManager**: Room state, queue management, player state
- **Commands**: Type-safe handlers for controller/display actions with leader validation

**Flow:** WebSocket → Handshake → Join Room → Leader Election → Send Commands → Receive Updates

### Display Leadership System

PWA Karaoke uses a **display leadership architecture** for multi-screen synchronization:

**Leader Display**: The first display to join a room becomes the leader
- Controls actual video playback (`<video>` element)
- Sends real-time state updates (current time, play state, volume)
- Responds to controller commands
- Updates sent via `update_player_state` commands

**Non-Leader Displays**: Additional displays that mirror the leader
- Receive state updates via WebSocket from leader
- Use smart synchronization to minimize visual lag
- Automatically promoted to leader if current leader disconnects
- Cannot send playback state updates (filtered by backend)

**Controllers**: Mobile/tablet interfaces for room control
- Send commands (play, pause, volume, queue management)
- Commands are broadcast to all displays in the room
- Multiple controllers can connect to the same room

**Leadership Election**: Managed by `SessionManager.ensure_room_display_leader()`
- First display to join becomes leader
- When leader disconnects, next available display is promoted
- All displays in room are notified of leadership changes via `leader_status` message

### Smart Synchronization

Frontend implements intelligent synchronization for non-leader displays:

- **State Interpolation**: Predicts current playback position between updates
- **Selective Hard Sync**: Only forces immediate synchronization for critical changes:
  - Play/pause commands from controllers
  - Song changes
  - Significant time drift (>2 seconds)
  - Manual seeks or version changes
- **Minimal Jitter**: Reduces micro-adjustments for smoother viewing experience

## Quick Start

### Prerequisites
- [uv](https://docs.astral.sh/uv/) (it downloads Python 3.12 for you if needed)

### Installation

1. **Install uv** (once):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```
   On Windows (PowerShell): `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`.
   `pip install uv` also works.

2. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

3. **Install dependencies**:
   ```bash
   uv sync
   ```

   This creates `.venv` with the locked dependencies from `uv.lock`, including
   `yt-dlp` and the `deno` JavaScript runtime it needs for YouTube.
   To use another runtime, set `YTDLP_RUNTIME` (for example `node` or
   `node:/usr/bin/node`). To update yt-dlp, run
   `uv lock --upgrade-package yt-dlp && uv sync`.

4. **Run the server**:
   ```bash
   uv run python main.py
   ```

   The server will start on `http://localhost:8000`
   - WebSocket endpoint: `ws://localhost:8000/ws`
   - Health endpoint: `http://localhost:8000/health`
   - Search endpoint: `http://localhost:8000/search?query=<search_term>&limit=<per_page>&offset=<skip>` (`limit` defaults to 12, capped at 50; `offset` defaults to 0)
   - Video URL endpoint: `POST http://localhost:8000/get_video_url`
   - Rooms endpoint: `http://localhost:8000/rooms`
   - API docs: `http://localhost:8000/docs`

   `/search` and `/get_video_url` require HTTP Basic auth: the room id is the username and the room password is the password (empty if the room has none). Create the room first with `POST /rooms/create`:

   ```bash
   curl -X POST http://localhost:8000/rooms/create \
     -H "Content-Type: application/json" \
     -d '{"room_id": "myroom"}'

   # Add "password": "secret" to the body above for a protected room, then use -u myroom:secret
   curl -u myroom: "http://localhost:8000/search?query=my%20way&limit=2"
   ```

## Source Providers

Every registered source is searched at once and the results are ranked together.
A provider fetches and normalises one source; ranking, duration filtering and
paging happen in `KaraokeService`, which is the only place that can compare
sources against each other.

### Provider Interface

```python
class KaraokeSourceProvider:
    curated: bool = False
    min_duration_seconds: float = 90.0
    max_duration_seconds: float = 900.0

    @property
    def provider_id(self) -> str: ...
    async def check_health(self) -> dict: ...
    async def search(self, query: str) -> list[SearchCandidate]: ...
    async def get_video_url(self, entry: KaraokeEntry) -> VideoURLResult: ...
    async def close(self): ...
```

| Member | Notes |
| --- | --- |
| `provider_id` | No default. Matches `source` on the entries produced, and is half of every cache key, so it must be stable and unique. |
| `curated` | Set on a source carrying nothing but karaoke cuts. Ranking looks for "karaoke" in a title, which such a source has no reason to print. |
| `min_duration_seconds` / `max_duration_seconds` | What counts as one singable track. Defaults suit a general video platform; lower the floor for a source of anime openings. |
| `search` | Return candidates unranked and untrimmed. Raise on failure rather than returning `[]`. |
| `get_video_url` | Build the result with `resolved()`, `unavailable()` or `failed()`. |
| `close` | Called on every provider at shutdown. Implement if yours holds an HTTP session. |

### Creating a New Source Provider

```python
# source_providers/basic_provider.py
from core.search import (
    KaraokeSourceProvider, KaraokeEntry, RankingSignals, SearchCandidate, VideoURLResult
)

class BasicVideoProvider(KaraokeSourceProvider):
    @property
    def provider_id(self) -> str:
        return "basic"

    async def search(self, query: str) -> list[SearchCandidate]:
        return [
            SearchCandidate(
                entry=KaraokeEntry(
                    id=result["id"],
                    title=result["title"],
                    artist=result["artist"],
                    source=self.provider_id,
                    uploader=result["uploader"],
                    duration=result["duration"],
                ),
                signals=RankingSignals(
                    position=position,
                    popularity=result.get("views", 0),
                    verified=result.get("official", False),
                ),
            )
            for position, result in enumerate(await your_api_search(query))
        ]

    async def get_video_url(self, entry: KaraokeEntry) -> VideoURLResult:
        return VideoURLResult.resolved(await your_api_get_stream_url(entry.id))
```

Set `video_url` on the entry instead when the URL is free to produce during
search. Track shape is read from URL presence rather than a mode flag: a source
supplying a bare instrumental leaves `video_url` unset.

### Ranking Signals

Ranking lives in `core/ranking.py`. Providers report signals rather than sorting
their own results, and leave a signal at its default rather than inventing one:

| Signal | Meaning |
| --- | --- |
| `position` | Where the source itself put the result |
| `popularity` | View count or nearest equivalent; 0 means unknown, not unpopular |
| `verified` | The uploader is authoritative for this track |

### Resolving Video URLs

Which constructor you use decides whether the answer is cached:

| Constructor | Use when | Cached |
| --- | --- | --- |
| `VideoURLResult.resolved(url, ttl)` | The URL is ready to play | Yes |
| `VideoURLResult.unavailable()` | The source answered no, and a deleted or private track stays deleted | Yes |
| `VideoURLResult.failed()` | The attempt broke down (timeout, proxy, missing binary) | No |

### Registration

Add a factory to `source_providers/registry.py`:

```python
PROVIDER_FACTORIES: dict[str, Callable[[], KaraokeSourceProvider]] = {
    "youtube": YTKaraokeSourceProvider,
    "basic": BasicVideoProvider,
}
```

Every known provider is enabled by default. `KARAOKE_SOURCES` narrows that to a
comma separated list of IDs (`KARAOKE_SOURCES=youtube,basic`); an unknown ID
fails at startup rather than going missing quietly. Providers are built once and
shared, so anything one accumulates survives between requests.

### Health

A provider is assumed usable by default. Override `check_health` if yours
depends on something that can break on its own:

```python
class BasicVideoProvider(KaraokeSourceProvider):
    async def check_health(self) -> dict:
        try:
            await your_api_ping()
            self.health.record_ok()
        except Exception as e:
            self.health.record_failure(str(e), fatal=True)
        return self.health.snapshot()
```

Report on whether the provider can still *resolve* a video, which is what makes
a queued song playable. A working search does not imply it: the YouTube provider
searches through the yt-dlp library but extracts through the CLI binary, so it
leaves health alone on a successful search.

Every provider's state is reported under `sources` on `/health`, which returns
503 once no provider can resolve a video.

### Built-in Providers

| ID | Source | Notes |
| --- | --- | --- |
| `youtube` | YouTube, via yt-dlp | Searches through the library, extracts through the CLI binary |


## HTTP API Endpoints

The backend provides a FastAPI-based HTTP server alongside the WebSocket functionality. HTTP endpoints are defined in `main.py`.

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /search` | Room (Basic) | `query`, `limit` (default 12, max 50), `offset` |
| `POST /get_video_url` | Room (Basic) | Body is a `KaraokeEntry` |
| `GET /health` | None | Connection metrics, cache stats and `sources`; 503 once no source can resolve a video |
| `GET /heartbeat` | None | `{"status": "ok", "timestamp": <ms>}` |
| `POST /rooms/create` | None | Body `{"room_id", "password"?}`; 400 if the room exists |
| `GET /rooms/{room_id}` | None | Public room info (`id`, `requires_password`, `created_at`); 404 if missing |
| `POST /rooms/verify` | Room (Basic) | Returns the room when the credentials are valid |

There is no endpoint that lists rooms. Any other path serves the built frontend from `static/`, with `index.html` as the fallback for client routes.

### Configuration

The server runs on `0.0.0.0` and port `PORT` (default 8000).

### CORS

Cross-origin requests are allowed from `localhost:5173`, `localhost:8000`, `127.0.0.1:5173` and `127.0.0.1:8000`, plus `http(s)://$DOMAIN` when the `DOMAIN` environment variable is set to something other than `localhost`. To modify CORS settings, update the `CORSMiddleware` configuration in `main.py`.

### API Documentation

Complete interactive API documentation is available at `http://localhost:8000/docs` when the server is running.

## WebSocket Protocol

The real-time communication layer is implemented via WebSocket at `/ws` endpoint. WebSocket handling is defined in `main.py`. Clients connect to manage room state, send commands, and receive live updates.

### Connection Flow

Clients establish connection by connecting to `ws://localhost:8000/ws`, then send a handshake message with their client type (`["handshake", {"client_type": "controller"}]` or `["handshake", {"client_type": "display"}]`). A handshake with an invalid payload gets an `error` message and the socket is closed. A malformed first message just closes it. After handshake completion, clients must join a room using `["join_room", {"room_id": "room_name"}]` (the room must already exist, see `POST /rooms/create`) before sending any room-scoped commands. On join the server sends `client_count`, `queue_update`, `room_settings` and, if set, `player_state`. Controllers also get `scoring_turn` and displays get `leader_status`.

The server pings every 30 seconds with `["ping", {"timestamp": number}]`. Clients answer with `["pong", {"timestamp": number}]`, and a client silent for more than 90 seconds is disconnected.

### Client Types

- **controller**: a remote. Queues songs, controls playback and sends reactions and score readings.
- **display**: a screen. The first display in a room is the leader, and only the leader's playback reports, score messages and removals are accepted.

### Message Format

All WebSocket communication uses JSON arrays: `[command_name, payload_object]`

**Standard message:**
```json
["queue_song", {"id": "123", "title": "Song Title", "artist": "Artist", "source": "youtube", "uploader": "Uploader", "duration": 200}]
```

**With acknowledgment:**
```json
["play_next", {"request_id": "unique_id"}]
```

**Acknowledgment response:**
```json
["ack", {"request_id": "unique_id", "success": true, "result": {...}}]
```

`result` is whatever the command method returned (often `null`). On failure the ack has `"success": false` and `error` holds the error object described under [Error Handling](#error-handling). Without a `request_id`, errors arrive as a separate `error` message and successful commands get no reply.

### Message Processing

For each message the server removes `request_id`, validates the payload, then calls the method of the same name on `ControllerCommands` or `DisplayCommands` (chosen by client type) in `commands.py`. Both classes inherit from `ClientCommands`. To add a command:

1. Register it in `COMMAND_PAYLOAD_MAP` in `websocket_models.py` with a payload model (or `dict` for no validation). A command missing from the map is rejected with `VALIDATION_ERROR`.
2. Add an async method of the same name to the appropriate command class in `commands.py`. A mapped command with no matching method for that client type is rejected with `INVALID_COMMAND`, as are names starting with `_`.

High frequency commands can be listed in `QUIET_COMMANDS` (currently `send_reaction` and `reaction`) to keep them out of the logs.

### Commands Reference

Commands a client sends. Payloads are validated against the models in `websocket_models.py`.

#### Both Client Types

```typescript
["join_room", {"room_id": string, "nickname"?: string, "device_id"?: string}] // nickname trimmed to 14 chars, device_id max 64
["pong", {"timestamp": number}]
["play_next", {"from_item_id"?: string}]
```

`handshake` is only valid as the first message. `play_next` pops the queue and starts the next turn. If `from_item_id` is set and is not the turn currently on air, the call is ignored and returns `{"advanced": false, "stale": true}`. Otherwise it returns `{"advanced": boolean}`.

#### Controller Commands

**Queue Management**
```typescript
// Add song to queue (nickname and device_id from join_room mark the singer)
["queue_song", KaraokeEntry] // title and artist must be non-empty

// Remove a queue item
["remove_song", {"entry_id": string}]

// Move a queue item to the front of the queue
["queue_next_song", {"entry_id": string}]

// Move a queue item to a specific position (0-indexed)
["move_song", {"item_id": string, "position": number}]

// Clear entire queue
["clear_queue", {}]
```

In `remove_song` and `queue_next_song` the field is named `entry_id` but the value is the queue item (reservation) `id` from `KaraokeQueueItem`, not the song's `KaraokeEntry.id`. `move_song` moves an item to the specified 0-indexed position.

**Playback Control**
```typescript
["play_song", {}]   // forwarded to displays as play_song
["pause_song", {}]  // forwarded to displays as pause_song
["skip_song", {}]   // forwarded to displays as skip_request
["set_volume", {"volume": number}] // 0.0 to 1.0, forwarded to displays
["set_autoplay", {"enabled": boolean}]
["player_state", DisplayPlayerState]
```

`play_song`, `pause_song` and `skip_song` return `{"screens": number}`. They do not change the room's play state. The leader display reports what happened through `update_player_state`. `set_autoplay` returns `{"autoplay": boolean}` and broadcasts `room_settings` when the value changed.

**Reactions and Scoring**
```typescript
["send_reaction", {"reaction": "clap" | "fire" | "heart" | "laugh" | "star" | "boo"}]
["submit_score", {"item_id": string, "performance": number}] // 0.0 to 1.0
```

`send_reaction` is rate limited per client (8 per 3s) and per room (20 per 3s). Over-limit reactions are dropped silently. `submit_score` is only honoured from the device that reserved the current turn, for the item on air, after at least `min_scored_seconds` of playback, and is limited to 4 per 10s. Rejected calls are dropped silently. Accepted readings go to displays as `score_reading`.

#### Display Commands

Leader only: every command below except `queue_update` is ignored when sent by a non-leader display.

**Player State Management**
```typescript
["update_player_state", DisplayPlayerState]
["video_loaded", DisplayPlayerState] // relayed to controllers as player_state
["refresh_video_url", {"entry_id": string}] // entry_id is the song's KaraokeEntry.id
["remove_song", {"entry_id": string}] // queue item id of the turn being dropped
```

`update_player_state` is ignored if it refers to a different turn than the one on air, or if it would reopen a `finished` turn. `refresh_video_url` re-resolves the URL of the song on air and returns `{"refreshed": boolean}`. `remove_song` returns `{"removed": boolean}`.

**Scoring**
```typescript
["scoring_state", {"active": boolean}] // forwarded to controllers
["publish_score", {"item_id": string, "score": number, "source": "mic" | "auto"}] // score 0 to 100, broadcast as score
```

**State Broadcasting**
```typescript
["queue_update", QueueData] // forwarded to controllers (any display, not only the leader)
```

### Server-to-Client Messages

#### State Updates
```typescript
["queue_update", {
  items: KaraokeQueueItem[],
  version: number,
  timestamp: number
}]

["player_state", DisplayPlayerState] // version and timestamp stamped by the server

["room_settings", {
  autoplay: boolean,
  min_scored_seconds: number,
  version: number,
  timestamp: number
}]
```

#### Connection Status
```typescript
["client_count", {"total": number, "controllers": number, "displays": number}]
["leader_status", {"is_leader": boolean}] // Displays only
["ping", {"timestamp": number}]
```

#### Forwarded Commands and Events
```typescript
// To displays
["play_song", {}]
["pause_song", {}]
["skip_request", {}]
["set_volume", number]
["reaction", {"id": string, "reaction": string, "timestamp": number}]
["score_reading", {"item_id": string, "performance": number}]

// To controllers
["scoring_state", {"active": boolean}]
["scoring_turn", {"active": boolean}] // true only for the device that reserved the current turn

// To everyone in the room
["score", {"item_id": string, "score": number, "source": "mic" | "auto", "timestamp": number}]
```

#### Responses and Errors
```typescript
["ack", {request_id: string, success: boolean, result?: any, error?: ErrorObject}]

["error", {
  error_type: string,
  message: string,
  details?: object,
  timestamp: number,
  request_id?: string
}]
```

### Data Models

#### KaraokeEntry
```typescript
{
  id: string,            // Unique only within its source
  title: string,
  artist: string,
  duration?: number,
  thumbnail_url?: string,
  video_url?: string,
  source: string,        // Provider ID that produced this entry
  uploader: string
}
```

#### DisplayPlayerState
```typescript
{
  entry: KaraokeEntry | null,
  item_id?: string,      // Queue item on air, stamped by the room
  singer?: string,       // Stamped by the room
  play_state: "playing" | "paused" | "finished" | "buffering" | "error" | "idle",
  current_time: number,  // Current position in seconds
  duration: number,      // Total duration in seconds
  volume: number,        // Volume level 0.0-1.0
  version: number,       // For conflict resolution
  timestamp: number      // Unix timestamp
}
```

`finished` keeps the song on the screen and `idle` means an empty room.

#### KaraokeQueueItem
```typescript
{
  id: string,            // Reservation id, used by remove_song and queue_next_song
  entry: KaraokeEntry,
  singer?: string,       // Nickname of the controller that queued it
  singer_device_id?: string
}
```

### Error Handling

#### Error Types
- `HANDSHAKE_FAILED`: Client handshake failed
- `VALIDATION_ERROR`: Message payload validation failed (including commands missing from `COMMAND_PAYLOAD_MAP`)
- `INVALID_COMMAND`: No handler for the command on this client type
- `COMMAND_EXECUTION_FAILED`: Command execution error

`CONNECTION_LOST`, `HEARTBEAT_TIMEOUT`, `AUTHORIZATION_ERROR`, `RATE_LIMIT_EXCEEDED`, `QUEUE_CONFLICT` and `STATE_SYNC_ERROR` are defined in `websocket_errors.py` but not currently sent. The wire value is the lowercase name (for example `command_execution_failed`).

#### Error Response Format
```json
["error", {
  "error_type": "command_execution_failed",
  "message": "Command execution failed: Room ID is required for broadcasting",
  "details": {
    "command": "queue_song",
    "client_type": "controller",
    "error": "Room ID is required for broadcasting"
  },
  "timestamp": 1700000000.0,
  "request_id": "optional_request_id"
}]
```

## Troubleshooting

### Search Not Working

When search functionality fails, check the server logs for YouTube search errors or API failures. Ensure your server has network connectivity to reach video platform APIs. If using a proxy, verify the proxy configuration in your environment variables.

### WebSocket Connection Issues

Connection problems often stem from port 8000 being blocked by firewall settings. If connecting from different domains, verify that the client's origin is in the CORS list in `main.py` (or set `DOMAIN`). Monitor server logs for connection errors and disconnections to identify patterns or specific client issues.

### Performance Issues

Performance problems can be diagnosed through the health endpoint at `/health`, which provides connection metrics including heartbeat timeouts and disconnection rates. The server pings every 30 seconds and drops clients that have not answered within 90 seconds (counted as `heartbeat_timeouts`), so clients on unstable networks may be disconnected. The interval is fixed in `client_manager.py`.

### Room Management Issues

- Verify room exists via `GET /rooms/{room_id}`
- Check password requirements via room verification endpoint
- Check `room_leadership` in `/health` to see whether a room has a leader display
- Ensure client joins room before sending room-scoped commands

### Caching Issues

- Check `video_cache` (total, hits, misses) and `search_cache` counts under `cache` in `/health`
- Cached video URLs default to a 1 hour TTL and search results to 30 minutes
- The cache is a temporary store that is deleted on shutdown
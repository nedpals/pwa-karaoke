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
  - [Media Kind](#media-kind)
  - [Registration](#registration)
  - [Health](#health)
  - [Built-in Providers](#built-in-providers)
- [HTTP API Endpoints](#http-api-endpoints)
- [WebSocket Protocol](#websocket-protocol)
  - [Connection Flow](#connection-flow)
  - [Client Types](#client-types)
  - [Message Format](#message-format)
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
- Python 3.11+ (tested with 3.12)
- pip package manager

### Installation

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment** (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the server**:
   ```bash
   python main.py
   ```

   The server will start on `http://localhost:8000`
   - WebSocket endpoint: `ws://localhost:8000/ws`
   - Health endpoint: `http://localhost:8000/health`
   - Search endpoint: `http://localhost:8000/search?query=<search_term>&limit=<per_page>&offset=<skip>` (`limit` defaults to 12, capped at 50; `offset` defaults to 0)
   - Video URL endpoint: `POST http://localhost:8000/get_video_url`
   - Rooms endpoint: `http://localhost:8000/rooms`
   - API docs: `http://localhost:8000/docs`

## Source Providers

The backend searches every registered source at once and ranks the results
together. A provider fetches and normalises one source; it does not rank,
filter by duration or paginate, because those are decided across all sources at
once and a provider only ever sees its own results.

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

`provider_id` has no default. It matches the `source` field on the entries the
provider produces, routes video URL requests back to it, and is half of every
cache key, so it has to be stable and unique across the registry.

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

Return everything that survives source specific filtering, unranked and
untrimmed. Trimming here hides candidates that might have outranked yours once
every source is compared.

Raising from `search` is safe. The service isolates each provider, records the
failure against its health, and serves what the other sources returned.
Returning an empty list instead loses the distinction between a broken source
and a song nobody has uploaded, and a run with a silently broken source gets its
thin result cached for the next half hour.

Set `video_url` on the entry when the URL is free to produce during search.
Leave it unset and implement `get_video_url` when resolving is expensive or
rate limited, which is the common case.

### Ranking Signals

Ranking is shared (`core/ranking.py`) so results from different sources can be
ordered against each other. Providers report the same few signals rather than
sorting their own results:

| Signal | Meaning |
| --- | --- |
| `position` | Where the source itself put the result |
| `popularity` | View count or nearest equivalent; 0 means unknown, not unpopular |
| `verified` | The uploader is authoritative for this track |

Two class attributes tune how a source is treated:

- `curated` marks a source carrying nothing but karaoke cuts. Ranking leans on
  titles saying "karaoke" to find the singable take on a general platform, and a
  dedicated catalogue would lose every tie for want of a word it has no reason
  to print.
- `min_duration_seconds` / `max_duration_seconds` bound what counts as a single
  singable track. The defaults suit a general video platform; anime openings run
  well under the floor a pop track needs, so a source carrying them should lower
  it.

### Resolving Video URLs

`get_video_url` returns a `VideoURLResult`, built through one of three
constructors. The choice decides whether the answer is cached:

| Constructor | Use when | Cached |
| --- | --- | --- |
| `VideoURLResult.resolved(url, ttl)` | The URL is ready to play | Yes |
| `VideoURLResult.unavailable()` | The source answered no, and a deleted or private track stays deleted | Yes |
| `VideoURLResult.failed()` | The attempt broke down (timeout, proxy, missing binary) | No |

Caching a `failed()` would keep a song unplayable long after the cause is fixed,
so it retries on the next attempt instead.

### Media Kind

`KaraokeEntry.media_kind` defaults to `"video"`, meaning the resolved URL plays
in a `<video>` with its lyrics already burned in. Set it to `"audio"` for a
source that supplies a bare instrumental, which tells the player the lyrics have
to be drawn over it rather than assumed.

### Registration

Add a factory to `source_providers/registry.py`:

```python
PROVIDER_FACTORIES: dict[str, Callable[[], KaraokeSourceProvider]] = {
    "youtube": YTKaraokeSourceProvider,
    "basic": BasicVideoProvider,
}
```

Every known provider is enabled by default. Set `KARAOKE_SOURCES` to a comma
separated list of IDs to narrow that (`KARAOKE_SOURCES=youtube,basic`). An
unknown ID fails at startup rather than being ignored, so a typo surfaces
immediately instead of as a quietly missing source.

Providers are built once and shared, so anything one accumulates (health,
sessions, rate limit state) survives between requests. `close` is called on
every provider at shutdown; implement it if yours holds an HTTP session open.

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
deliberately leaves health alone on a successful search.

Every provider's state is reported under `sources` on `/health`, which returns
503 once no provider can resolve a video.

### Built-in Providers

| ID | Source | Notes |
| --- | --- | --- |
| `youtube` | YouTube, via yt-dlp | Searches through the library, extracts through the CLI binary |


## HTTP Server

The backend provides a FastAPI-based HTTP server alongside the WebSocket functionality. HTTP endpoints are defined in `main.py` and handle search operations and health monitoring.

### Configuration

The server runs on `0.0.0.0:8000` (accessible from all interfaces) and is currently configured for development.

### CORS

Cross-origin requests are currently allowed from all origins (`["*"]`) for production hosting. To modify CORS settings, update the `CORSMiddleware` configuration in `main.py`.

### API Documentation

Complete interactive API documentation is available at `http://localhost:8000/docs` when the server is running.

## WebSocket Server

The real-time communication layer is implemented via WebSocket at `/ws` endpoint. WebSocket handling is defined in `main.py`. Clients connect to manage room state, send commands, and receive live updates.

### Message Format

All WebSocket communication uses JSON arrays: `[command_name, payload_object]`

**Standard message:**
```json
["queue_song", {"id": "123", "title": "Song Title", "artist": "Artist"}]
```

**With acknowledgment:**
```json
["queue_song", {"id": "123", "title": "Song Title", "request_id": "unique_id"}]
```

**Acknowledgment response:**
```json
["ack", {"request_id": "unique_id", "success": true, "result": {...}}]
```

### Connection Flow

Clients establish connection by connecting to `ws://localhost:8000/ws`, then send a handshake message with their client type (`["handshake", {"client_type": "controller"}]` or `["handshake", {"client_type": "display"}]`). After handshake completion, clients must join a room using `["join_room", {"room_id": "room_name"}]` before sending any room-scoped commands.

### Message Processing

The server processes incoming WebSocket messages by extracting the command name and routing it to the appropriate handler. Commands are defined in `commands.py` with separate classes for `ControllerCommands` and `DisplayCommands`. Each command is implemented as an async method that matches the command name. To add new commands, create a new method in the appropriate command class - the server will automatically route messages to methods with matching names.

### Commands Reference

#### Common Commands (Both Client Types)

**Connection Management**
```typescript
["handshake", {"client_type": "controller" | "display"}]
["join_room", {"room_id": string}]
["pong", {"timestamp": number}]
```

#### Controller Commands

**Queue Management**
```typescript
// Add song to queue
["queue_song", KaraokeEntry]

// Remove song from queue
["remove_song", {"entry_id": string}]

// Move song to next position
["queue_next_song", {"entry_id": string}]

// Clear entire queue
["clear_queue", {}]

// Play next song in queue
["play_next", {}]
```

**Playback Control**
```typescript
["play_song", {}]
["pause_song", {}]
["set_volume", {"volume": number}] // 0.0 to 1.0
```

**State Management**
```typescript
["player_state", DisplayPlayerState]
```

#### Display Commands

**Player State Management**
```typescript
["update_player_state", DisplayPlayerState]
["video_loaded", DisplayPlayerState]
```

**State Broadcasting**
```typescript
["queue_update", QueueData]
```

### Server-to-Client Messages

#### State Updates
```typescript
["queue_update", {
  items: KaraokeQueueItem[],
  version: number,
  timestamp: number
}]

["player_state", {
  entry: KaraokeEntry | null,
  play_state: "playing" | "paused" | "loading",
  progress: number,
  volume: number,
  version: number,
  timestamp: number
}]
```

#### Connection Status
```typescript
["client_count", number]
["leader_status", {"is_leader": boolean}] // Displays only
["ping", {"timestamp": number}]
```

#### Commands
```typescript
// Control Commands (to displays)
["play_song", {}]
["pause_song", {}]
["set_volume", number]

// Queue Commands (to controllers)
["queue_update", QueueData]
```

#### Errors
```typescript
["error", {
  error_type: string,
  message: string,
  details?: object,
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
  uploader: string,
  media_kind?: "video" | "audio"
}
```

#### DisplayPlayerState
```typescript
{
  entry: KaraokeEntry | null,
  play_state: "playing" | "paused" | "buffering" | "finished",
  current_time: number,  // Current position in seconds
  duration: number,      // Total duration in seconds
  volume: number,        // Volume level 0.0-1.0
  version: number,       // For conflict resolution
  timestamp: number      // Unix timestamp
}
```

#### KaraokeQueueItem
```typescript
{
  id: string,
  entry: KaraokeEntry,
  added_at: number,      // Unix timestamp
  added_by?: string
}
```

### Error Handling

#### Error Types
- `HANDSHAKE_FAILED`: Client handshake failed
- `VALIDATION_ERROR`: Message payload validation failed
- `INVALID_COMMAND`: Unknown or invalid command
- `COMMAND_EXECUTION_FAILED`: Command execution error

#### Error Response Format
```json
["error", {
  "error_type": "COMMAND_EXECUTION_FAILED",
  "message": "Room ID is required for broadcasting",
  "details": {
    "command": "queue_song",
    "client_type": "controller"
  },
  "request_id": "optional_request_id"
}]
```

## Troubleshooting

### Search Not Working

When search functionality fails, check the server logs for YouTube search errors or API failures. Ensure your server has network connectivity to reach video platform APIs. If using a proxy, verify the proxy configuration in your environment variables.

### WebSocket Connection Issues

Connection problems often stem from port 8000 being blocked by firewall settings. If connecting from different domains, verify that CORS settings in the FastAPI configuration allow your client's origin. Monitor server logs for connection errors and disconnections to identify patterns or specific client issues.

### Performance Issues

Performance problems can be diagnosed through the health endpoint at `/health`, which provides connection metrics including heartbeat timeouts and disconnection rates. If network connectivity is unstable, consider reducing heartbeat frequency to prevent unnecessary disconnections from timeout issues.

### Room Management Issues

- Verify room exists via `GET /rooms/{room_id}`
- Check password requirements via room verification endpoint
- Monitor room leadership status in logs
- Ensure client joins room before sending room-scoped commands

### Caching Issues

- Monitor cache hit rates via `/health` endpoint
- Check memory usage in cache statistics
- Video URL cache has configurable TTL settings
- Cache cleanup runs automatically for expired entries
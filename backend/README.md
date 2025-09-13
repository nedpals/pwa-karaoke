# PWA Karaoke Backend

A FastAPI-based WebSocket server for managing karaoke rooms, song queues, and player state synchronization.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Source Providers](#source-providers)
  - [Creating a New Source Provider](#creating-a-new-source-provider)
  - [Provider Interface](#provider-interface)
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

Simple, modular architecture for multi-room karaoke:

```
FastAPI Server (/ws)
        │
   SessionManager ─── Manages rooms & clients
    │         │
ClientManager  RoomManager
    │         │
Connections   Room State
Heartbeat     Queue & Player
Leadership    Versioning
```

**Key Components:**
- **SessionManager**: Coordinates everything, handles room-scoped operations
- **ClientManager**: WebSocket connections, heartbeat, metrics  
- **RoomManager**: Room state, queue management, player state
- **Commands**: Type-safe handlers for controller/display actions

**Flow:** WebSocket → Handshake → Join Room → Send Commands → Receive Updates

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
   - Search endpoint: `http://localhost:8000/search?query=<search_term>`
   - Video URL endpoint: `POST http://localhost:8000/get_video_url`
   - Rooms endpoint: `http://localhost:8000/rooms`
   - API docs: `http://localhost:8000/docs`

## Source Providers

The backend supports multiple video sources through a pluggable provider system. Implement custom providers to search additional video platforms beyond the built-in YouTube provider.

### Basic Example

Create a provider that returns video URLs immediately during search:

```python
# source_providers/basic_provider.py
from core.search import KaraokeSourceProvider, KaraokeSearchResult, KaraokeEntry

class BasicVideoProvider(KaraokeSourceProvider):
    @property
    def provider_id(self) -> str:
        return "basic"
    
    async def search(self, query: str) -> KaraokeSearchResult:
        entries = []
        
        # Your search logic here
        search_results = await your_api_search(query)
        
        for result in search_results:
            entries.append(KaraokeEntry(
                id=result["id"],
                title=result["title"],
                artist=result["artist"],
                source="basic",
                uploader=result["uploader"],
                duration=result["duration"],
                video_url=result["direct_url"]  # Include URL directly
            ))
        
        return KaraokeSearchResult(entries=entries)
```

### Registration

Add your provider to the service in `services/karaoke_service.py`:

```python
from source_providers.basic_provider import BasicVideoProvider

class KaraokeService:
    def __init__(self, cache):
        self.source_providers = [
            YTKaraokeSourceProvider(),
            BasicVideoProvider(),  # Add your provider here
        ]
        self.cache = cache
```

### Lazy Loading with get_video_url

For scenarios where fetching video URLs during search is inefficient (rate limits, expensive API calls, etc.), implement `get_video_url`:

```python
class LazyVideoProvider(KaraokeSourceProvider):
    @property
    def provider_id(self) -> str:
        return "lazy"
    
    async def search(self, query: str) -> KaraokeSearchResult:
        entries = []
        search_results = await your_api_search(query)
        
        for result in search_results:
            entries.append(KaraokeEntry(
                id=result["id"],
                title=result["title"],
                artist=result["artist"],
                source="lazy",
                uploader=result["uploader"],
                duration=result["duration"]
                # No video_url - will be fetched on-demand
            ))
        
        return KaraokeSearchResult(entries=entries)
    
    async def get_video_url(self, entry: KaraokeEntry) -> Union[str, VideoURLResult, None]:
        # Fetch video URL when actually needed
        return VideoURLResult(
            video_url=await your_api_get_stream_url(entry.id),
            cache_ttl_seconds=3600,
            cacheable=True
        )
```

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
["leader_status", {"is_leader": boolean}] // Controllers only
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
  id: string,
  title: string,
  artist: string,
  duration?: number,
  thumbnail_url?: string,
  video_url?: string,
  source: string,
  uploader: string
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
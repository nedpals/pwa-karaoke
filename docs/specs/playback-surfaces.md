# Playback Surfaces

## Problem

Every song plays through a stream URL that the backend resolves with yt-dlp and
hands to a `<video>` element. That ties playback to the server's standing with
YouTube:

- Datacenter IPs get bot checks, and some videos only offer split or PO token
  protected formats, which ends in "Requested format is not available".
- Stream URLs are bound to the IP that resolved them, so a display on another
  network can be refused.
- Hosts such as Railway forbid relaying video through the server.

## Goal

Play through the source's own embed player when the source has one, and keep
the resolved stream as the fallback. Shape the display so that a new embed
player (Vimeo, Dailymotion, ...) is one adapter plus one registry line.

## Non goals

- Relaying or proxying media through the backend.
- PO token providers or cookies for the yt-dlp fallback.
- Changing search, ranking or scoring. Scoring listens to the microphone only.

## Concepts

| Term | Meaning |
| --- | --- |
| Surface | What renders a song on the display: an embed player or the native `<video>` element. |
| Embed | A provider's own player addressed by `{player, id}`, e.g. `{player: "youtube", id: "RW4x19-NUDg"}`. |
| Media | A direct stream URL played by `<video>`. Today's `video_url`. |
| Fallback | Switching a song from its embed to media after the embed refused to play it. |

## Data model

`KaraokeEntry` gains one optional field:

```python
class EmbedSource(BaseModel):
    player: str  # key into the display's embed player registry
    id: str      # the provider's id for the video in that player

class KaraokeEntry(BaseModel):
    ...
    video_url: Optional[str] = None      # media, resolved lazily
    embed: Optional[EmbedSource] = None  # set by the server only
```

The frontend `KaraokeEntry` type mirrors it.

## Backend

### Provider contract

`KaraokeSourceProvider.embed_source(entry) -> Optional[EmbedSource]`, default
`None`. The YouTube provider returns `EmbedSource(player="youtube", id=entry.id)`.

### Service

`KaraokeService.with_playback(entry) -> KaraokeEntry` returns a copy whose
`embed` is decided by the server:

- `None` when `EMBED_PLAYBACK` is off, the provider has no embed, or the entry
  is in the embed blocklist.
- Otherwise the provider's `embed_source`.

Client supplied `embed` values are always discarded.

`KaraokeService.block_embed(entry)` records the entry in the blocklist.

### Cache

New `embed_blocklist` table keyed by `(entry_id, source)` with an expiry.
Default TTL 7 days. Methods: `block_embed`, `is_embed_blocked`. Expired rows are
removed by the existing cleanup.

### Config

| Variable | Default | Effect |
| --- | --- | --- |
| `EMBED_PLAYBACK` | `1` | `0` disables embeds, so every song uses media as before. |

### Commands

- `queue_song`: the entry goes through `with_playback` before it is queued.
- Prefetch of media URLs skips entries that have an embed. Media is only
  resolved for songs that need it.
- New display command `embed_failed` with payload `{entry_id, reason}`, leader
  only, for the song on air:
  1. Block the embed for that entry.
  2. Clear `embed` on the on air entry and on every queued item with the same
     `(source, id)`.
  3. Resolve media through `get_video_url`.
  4. Publish the player state: `buffering` at the same position when a URL
     resolved, otherwise `error`.
  5. Ack `{fallback: bool}`.
- `update_player_state`: when the report is for the turn on air, the room keeps
  its own `entry`. A display echo sent before a fallback landed would otherwise
  restore the embed and loop.

`GET /get_video_url` and `refresh_video_url` keep their behaviour and serve the
media path.

## Frontend

### Player adapter

`src/players/types.ts`

```ts
interface PlayerSnapshot {
  currentTime: number;
  duration: number;
  volume: number; // 0..1
  paused: boolean; // false while buffering, as with <video>
  ended: boolean;
}

interface PlayerHandle {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  snapshot(): PlayerSnapshot;
}

type PlayerError = { kind: "stream" } | { kind: "embed"; code: string };

interface PlayerEvents {
  onReady(): void;      // can start or resume
  onPlay(): void;
  onPause(): void;
  onBuffering(): void;
  onTimeUpdate(): void;
  onEnded(): void;
  onError(error: PlayerError): void;
}
```

Adapters expose a `PlayerHandle` through `ref`, read `events` through a ref so
handler identity changes never rebuild the player, and ignore handle calls
until ready.

| Adapter | File | Notes |
| --- | --- | --- |
| Native | `src/players/NativeVideoPlayer.tsx` | Wraps `<video>`. Reloads when `src` changes. Media errors are `stream`. |
| YouTube | `src/players/YouTubeEmbedPlayer.tsx` | IFrame Player API, loaded once by `src/players/youtubeIframeApi.ts`. No controls, keyboard, fullscreen button or annotations; `rel=0`, `playsinline=1`, `origin` set, `allow="autoplay"`. Polls time every 250 ms while playing. API load failures and player errors are `embed`. |

`src/players/registry.ts` maps `embed.player` to an adapter:

```ts
const EMBED_PLAYERS: Record<string, EmbedPlayerComponent> = { youtube: YouTubeEmbedPlayer };
```

An entry whose `embed.player` is not registered is treated as media.

### Player page

`VideoPlayerComponent` drives a `PlayerHandle` instead of a `<video>` ref. The
room sync, periodic reports, nearing end detection, buffering watchdog and
unload save are shared by both surfaces.

| Situation | Native | Embed |
| --- | --- | --- |
| Surface | `NativeVideoPlayer` with the media URL | Registered embed adapter |
| URL loading screen | While the media URL resolves | Never |
| Player error | Re-resolve via `refresh_video_url`, as today | Leader sends `embed_failed` |
| Buffering watchdog | 25 s, then re-resolve | 90 s, since ads hold the player, then `embed_failed` |

The media URL hooks (`useVideoUrlWithRetry`, next song prefetch) only run for
entries that will play as media.

`useRoom` gains `reportEmbedFailure(entryId, reason)`.

## Failure flow

1. The embed reports an error or stalls past 90 s.
2. The leader sends `embed_failed`.
3. The server blocks the embed, resolves media and republishes the state with
   `embed` cleared.
4. Every display swaps to the native surface and resumes from the room's
   position. A failed resolution shows the existing Disc Error screen with its
   Retry.
5. The next time anyone queues that song it starts on media.

## Compatibility

- Cached search results and entries queued before the deploy carry no `embed`
  and play as media.
- `EMBED_PLAYBACK=0` restores the previous behaviour.

## Implementation order

1. `docs`: this spec.
2. `feat(backend)`: `EmbedSource`, provider hook, blocklist, `with_playback`,
   `embed_failed`, entry ownership in `update_player_state`, config.
3. `refactor(frontend)`: player adapter types and the native adapter; the
   player page drives a handle.
4. `feat(frontend)`: YouTube embed adapter, registry, embed fallback flow.
5. `docs`: README and backend README updates.

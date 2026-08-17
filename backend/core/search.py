import time

from pydantic import BaseModel, Field
from typing import Literal, Optional

# Suits a general purpose video platform. A provider whose catalogue is shaped
# differently overrides them; anime openings run well under the floor a pop
# track needs.
DEFAULT_MIN_DURATION_SECONDS = 90.0
DEFAULT_MAX_DURATION_SECONDS = 15 * 60.0

# "audio" marks a track that needs lyrics drawn over it rather than burned into
# the video, so the player can pick a surface instead of assuming a <video>.
MediaKind = Literal["video", "audio"]


class KaraokeEntry(BaseModel):
    id: str  # Unique only within its source
    title: str
    artist: str
    video_url: Optional[str] = None
    source: str
    uploader: str
    duration: Optional[float]
    thumbnail_url: Optional[str] = None
    media_kind: MediaKind = "video"


class RankingSignals(BaseModel):
    """
    What a provider knows about a result that does not belong on the entry.

    Every provider reports the same few signals so the service can compare
    results it did not fetch itself. A provider that cannot supply one leaves it
    at its default rather than inventing a value.
    """

    position: int = 0
    popularity: float = 0.0  # View count or nearest equivalent; 0 means unknown
    verified: bool = False


class SearchCandidate(BaseModel):
    entry: KaraokeEntry
    signals: RankingSignals = Field(default_factory=RankingSignals)


class KaraokeSearchResult(BaseModel):
    """A page of hits, as the HTTP API returns them. Providers do not build this."""

    entries: list[KaraokeEntry]
    total: int = 0


class VideoURLResult(BaseModel):
    video_url: Optional[str]
    cache_ttl_seconds: int = 3600
    cacheable: bool = True

    @classmethod
    def resolved(cls, video_url: str, cache_ttl_seconds: int = 3600) -> "VideoURLResult":
        return cls(video_url=video_url, cache_ttl_seconds=cache_ttl_seconds, cacheable=True)

    @classmethod
    def unavailable(cls, cache_ttl_seconds: int = 30 * 60) -> "VideoURLResult":
        """The source answered no. A deleted or private track stays deleted, so remember it."""
        return cls(video_url=None, cache_ttl_seconds=cache_ttl_seconds, cacheable=True)

    @classmethod
    def failed(cls) -> "VideoURLResult":
        """
        The attempt broke down for a reason that says nothing about this track.
        Caching it would keep the song unplayable after the cause is fixed.
        """
        return cls(video_url=None, cacheable=False)


class ProviderHealth:
    """
    Liveness state for a single source provider.

    A provider that has stopped resolving videos otherwise shows up only as
    songs that queue and never play, which stays invisible until someone reads
    the logs. Providers record outcomes here so /health can report them.
    """

    def __init__(self, available: bool = True):
        self.available = available
        self.version: Optional[str] = None
        self.consecutive_failures: int = 0
        self.last_error: Optional[str] = None
        self.last_success_at: Optional[float] = None

    def record_ok(self, version: Optional[str] = None):
        self.available = True
        self.consecutive_failures = 0
        self.last_error = None
        self.last_success_at = time.time()
        if version:
            self.version = version

    def record_failure(self, detail: str, fatal: bool = False):
        """Set fatal when the provider itself is broken rather than the request having failed."""
        self.consecutive_failures += 1
        self.last_error = detail[:500]
        if fatal:
            self.available = False

    def snapshot(self) -> dict:
        return {
            "available": self.available,
            "version": self.version,
            "consecutive_failures": self.consecutive_failures,
            "last_error": self.last_error,
            "last_success_at": self.last_success_at,
        }


class KaraokeSourceProvider:
    """
    One searchable source of karaoke tracks.

    A provider fetches and normalises. It does not rank, filter by duration or
    paginate, because those are decided across every source at once and a
    provider sees only its own results.
    """

    # For a source carrying nothing but karaoke cuts. Ranking leans on titles
    # saying "karaoke", and a dedicated catalogue would lose every tie for want
    # of a word it has no reason to print.
    curated: bool = False

    min_duration_seconds: float = DEFAULT_MIN_DURATION_SECONDS
    max_duration_seconds: float = DEFAULT_MAX_DURATION_SECONDS

    def __init__(self) -> None:
        self.health = ProviderHealth()

    @property
    def provider_id(self) -> str:
        """
        Matches the `source` field on the entries this provider produces. It
        routes video URL requests back here and is half of every cache key.
        """
        raise NotImplementedError(f"{type(self).__name__} must define provider_id")

    async def check_health(self) -> dict:
        """
        Override when the provider leans on something that can break on its own,
        such as an external tool or an API credential.
        """
        return self.health.snapshot()

    async def search(self, query: str) -> list[SearchCandidate]:
        """
        Return everything that survives source specific filtering, unranked and
        untrimmed. Trimming here hides candidates that might have outranked ours.

        Raising is safe: the service isolates each provider and records the
        failure. Returning an empty list instead loses the distinction between a
        broken source and a song nobody has uploaded.
        """
        return []

    async def get_video_url(self, entry: KaraokeEntry) -> VideoURLResult:
        """
        Use VideoURLResult.unavailable() when the source has answered that the
        track cannot be played, and failed() when the attempt itself broke down.
        The difference decides whether the answer is cached.
        """
        return VideoURLResult.failed()

    async def close(self):
        pass

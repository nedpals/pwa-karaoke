import time

from pydantic import BaseModel, Field
from typing import Optional

# Suits a general video platform. Anime openings run well under this floor.
DEFAULT_MIN_DURATION_SECONDS = 90.0
DEFAULT_MAX_DURATION_SECONDS = 15 * 60.0


class KaraokeEntry(BaseModel):
    id: str  # Unique only within its source
    title: str
    artist: str
    video_url: Optional[str] = None
    audio_url: Optional[str] = None  # When set, video_url carries no audio of its own
    source: str
    uploader: str
    duration: Optional[float]
    thumbnail_url: Optional[str] = None


class RankingSignals(BaseModel):
    """What a provider knows about a result that does not belong on the entry."""

    position: int = 0
    popularity: float = 0.0  # 0 means unknown, not unpopular
    verified: bool = False


class SearchCandidate(BaseModel):
    entry: KaraokeEntry
    signals: RankingSignals = Field(default_factory=RankingSignals)


class KaraokeSearchResult(BaseModel):
    """The HTTP response. Providers return candidates and never build this."""

    entries: list[KaraokeEntry]
    total: int = 0


class VideoURLResult(BaseModel):
    video_url: Optional[str]
    audio_url: Optional[str] = None
    cache_ttl_seconds: int = 3600
    cacheable: bool = True

    @property
    def has_media(self) -> bool:
        return bool(self.video_url or self.audio_url)

    @classmethod
    def resolved(
        cls,
        video_url: Optional[str] = None,
        cache_ttl_seconds: int = 3600,
        audio_url: Optional[str] = None,
    ) -> "VideoURLResult":
        """
        A populated audio_url means video_url carries no audio of its own and
        the two are played together, so they must come from one resolution. A
        source with nothing but a bare instrumental passes audio_url alone.
        """
        return cls(
            video_url=video_url,
            audio_url=audio_url,
            cache_ttl_seconds=cache_ttl_seconds,
            cacheable=True,
        )

    @classmethod
    def unavailable(cls, cache_ttl_seconds: int = 30 * 60) -> "VideoURLResult":
        """The source answered no. A deleted track stays deleted, so remember it."""
        return cls(video_url=None, audio_url=None, cache_ttl_seconds=cache_ttl_seconds, cacheable=True)

    @classmethod
    def failed(cls) -> "VideoURLResult":
        """
        The attempt broke down, which says nothing about the track. Caching it
        would keep the song unplayable after the cause is fixed.
        """
        return cls(video_url=None, audio_url=None, cacheable=False)


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
        """
        Record a failure. Set fatal when the provider itself is broken rather
        than the request having failed, which marks it unavailable.
        """
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
    A provider fetches and normalises one source. It does not rank, filter by
    duration or paginate: those compare sources against each other, and a
    provider sees only its own results.
    """

    # Set on a source carrying nothing but karaoke cuts, which have no reason to
    # print the word ranking otherwise looks for.
    curated: bool = False

    min_duration_seconds: float = DEFAULT_MIN_DURATION_SECONDS
    max_duration_seconds: float = DEFAULT_MAX_DURATION_SECONDS

    def __init__(self) -> None:
        self.health = ProviderHealth()

    @property
    def provider_id(self) -> str:
        """Matches `source` on this provider's entries and is half of every cache key."""
        raise NotImplementedError(f"{type(self).__name__} must define provider_id")

    async def check_health(self) -> dict:
        """
        Refresh and return this provider's health.

        The default treats a provider as usable, which is right for one with no
        external dependency. Override when the provider leans on something that
        can break on its own, such as an external tool or an API credential.
        """
        return self.health.snapshot()

    async def search(self, query: str) -> list[SearchCandidate]:
        """
        Everything that survives source specific filtering, unranked and
        untrimmed. Trimming here hides candidates that outrank ours elsewhere.

        Raise on failure. The service isolates each provider and records it;
        an empty list instead reads as a song nobody has uploaded.
        """
        return []

    async def get_video_url(self, entry: KaraokeEntry) -> VideoURLResult:
        """Build the result with resolved(), unavailable() or failed()."""
        return VideoURLResult.failed()

    async def close(self):
        pass

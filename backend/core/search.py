import time

from pydantic import BaseModel
from typing import Optional, Union

class KaraokeEntry(BaseModel):
    id: str  # Use source ID directly (e.g., YouTube video ID)
    title: str
    artist: str
    video_url: Optional[str] = None  # Now optional for lazy loading
    audio_url: Optional[str] = None  # When set, video_url carries no audio of its own
    source: str
    uploader: str
    duration: Optional[float]
    thumbnail_url: Optional[str] = None

class KaraokeSearchResult(BaseModel):
    entries: list[KaraokeEntry]
    # Matches across every page, so a caller knows whether more can be asked
    # for. Providers leave this alone; the service fills it in.
    total: int = 0

class VideoURLResult(BaseModel):
    video_url: Optional[str]
    audio_url: Optional[str] = None
    cache_ttl_seconds: int = 3600
    cacheable: bool = True

    @property
    def has_media(self) -> bool:
        return bool(self.video_url or self.audio_url)

class ProviderHealth:
    """
    Liveness state for a single source provider.

    A provider that has stopped resolving videos otherwise shows up only as
    songs that queue and never play, which stays invisible until someone reads
    the logs. Providers record outcomes here so /health can report them.
    """

    def __init__(self, available: bool = True):
        self.available = available
        self.version: Optional[str] = None  # Version of the backing dependency, when it has one
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
    def __init__(self) -> None:
        self.health = ProviderHealth()

    async def check_health(self) -> dict:
        """
        Refresh and return this provider's health.

        The default treats a provider as usable, which is right for one with no
        external dependency. Override when the provider leans on something that
        can break on its own, such as an external tool or an API credential.
        """
        return self.health.snapshot()
    
    @property
    def provider_id(self) -> str:
        """
        Return the provider ID that should match the 'source' field in KaraokeEntry.
        Should be implemented by subclasses.
        """
        return "unknown"

    async def search(self, query: str) -> KaraokeSearchResult:
        # Implement search logic here
        return KaraokeSearchResult(entries=[])
    
    async def get_video_url(self, entry: KaraokeEntry) -> Union[str, VideoURLResult, None]:
        """
        Fetch the actual media URLs for an entry on demand.
        Should be implemented by subclasses that support lazy loading.

        Args:
            entry: KaraokeEntry that needs media URL fetching

        Returns:
            - str: Simple video URL (uses default cache settings)
            - VideoURLResult: Video and/or audio URL with custom cache settings.
              Audio-only sources may leave video_url unset.
            - None: No media available
        """
        return None  # Default implementation - no media available

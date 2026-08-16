from pydantic import BaseModel
from typing import Optional, Union

class KaraokeEntry(BaseModel):
    id: str  # Use source ID directly (e.g., YouTube video ID)
    title: str
    artist: str
    video_url: Optional[str] = None  # Now optional for lazy loading
    audio_url: Optional[str] = None  # Separate audio track, when the source exposes one
    source: str
    uploader: str
    duration: Optional[float]
    thumbnail_url: Optional[str] = None

class KaraokeSearchResult(BaseModel):
    entries: list[KaraokeEntry]

class VideoURLResult(BaseModel):
    video_url: Optional[str]
    audio_url: Optional[str] = None
    cache_ttl_seconds: int = 3600
    cacheable: bool = True

    @property
    def has_media(self) -> bool:
        return bool(self.video_url or self.audio_url)

class KaraokeSourceProvider:
    def __init__(self) -> None:
        pass
    
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

from pydantic import BaseModel
from typing import Optional, Union

class KaraokeEntry(BaseModel):
    id: str  # Use source ID directly (e.g., YouTube video ID)
    title: str
    artist: str
    video_url: Optional[str] = None  # Now optional for lazy loading
    source: str
    uploader: str
    duration: Optional[float]

class KaraokeSearchResult(BaseModel):
    entries: list[KaraokeEntry]

class VideoURLResult(BaseModel):
    video_url: Optional[str]
    cache_ttl_seconds: int = 3600
    cacheable: bool = True 

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
        Fetch the actual video URL for an entry on demand.
        Should be implemented by subclasses that support lazy loading.

        Args:
            entry: KaraokeEntry that needs video URL fetching

        Returns:
            - str: Simple video URL (uses default cache settings)
            - VideoURLResult: Video URL with custom cache settings
            - None: No video URL available
        """
        return None  # Default implementation - no video URL available

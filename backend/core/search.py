from pydantic import BaseModel
from typing import Optional

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

class KaraokeSearchProvider:
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
    
    async def get_video_url(self, entry: KaraokeEntry) -> Optional[str]:
        """
        Fetch the actual video URL for an entry on demand.
        Should be implemented by subclasses that support lazy loading.
        
        Args:
            entry: KaraokeEntry that needs video URL fetching
            
        Returns:
            The actual video URL or None if not available
        """
        return None  # Default implementation - no video URL available

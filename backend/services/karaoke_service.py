from pydantic import BaseModel

from core.search import KaraokeSearchResult, KaraokeEntry
from search_providers.youtube import YTKaraokeSearchProvider

class VideoURLResponse(BaseModel):
    video_url: str | None

class KaraokeService:
    def __init__(self):
        self.search_providers = [
            YTKaraokeSearchProvider()
        ]

    async def search(self, query: str):
        all_entries = []
        for provider in self.search_providers:
            result = await provider.search(query)
            all_entries.extend(result.entries)
        return KaraokeSearchResult(entries=all_entries)

    async def get_video_url(self, entry: KaraokeEntry) -> VideoURLResponse:
        """Get video URL for an entry using the appropriate provider based on source field"""
        # Return existing URL if already present
        if entry.video_url:
            return VideoURLResponse(video_url=entry.video_url)

        # Find matching provider and get video URL
        for provider in self.search_providers:
            if provider.provider_id == entry.source:
                got_video_url = await provider.get_video_url(entry)
                return VideoURLResponse(video_url=got_video_url)

        # No provider found or no URL available
        return VideoURLResponse(video_url=None)

from core.search import KaraokeSearchResult
from search_providers.youtube import YTKaraokeSearchProvider

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

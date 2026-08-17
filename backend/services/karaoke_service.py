from pydantic import BaseModel, ValidationError
from typing_extensions import Annotated
from fastapi import Depends

from core.search import KaraokeSearchResult, KaraokeEntry, VideoURLResult, KaraokeSourceProvider
from source_providers.youtube import YTKaraokeSourceProvider
from cache_store import get_cache_store, CacheStore

# Providers are shared rather than rebuilt per request. KaraokeService is
# constructed through Depends on every call, so anything a provider accumulates
# (health, sessions, rate limit state) would otherwise reset each time.
# Register additional providers here.
SOURCE_PROVIDERS: list[KaraokeSourceProvider] = [
    YTKaraokeSourceProvider()
]

SEARCH_CACHE_TTL_SECONDS = 30 * 60

DEFAULT_SEARCH_LIMIT = 12
MAX_SEARCH_LIMIT = 50

class VideoURLResponse(BaseModel):
    video_url: str | None

class KaraokeService:
    def __init__(self, cache: Annotated[CacheStore, Depends(get_cache_store)] = None):
        self.source_providers = SOURCE_PROVIDERS
        self.cache = cache

    async def get_health(self) -> dict:
        """
        Per-provider health, plus whether any provider can still resolve a
        video. Playback is only impossible once every provider is down.
        """
        providers = {}
        for provider in self.source_providers:
            try:
                providers[provider.provider_id] = await provider.check_health()
            except Exception as e:
                print(f"[SERVICE] Health check failed for {provider.provider_id}: {e}")
                providers[provider.provider_id] = {
                    "available": False,
                    "last_error": str(e)[:500]
                }

        return {
            "available": any(p.get("available") for p in providers.values()),
            "providers": providers
        }

    async def search(
        self,
        query: str,
        limit: int = DEFAULT_SEARCH_LIMIT,
        offset: int = 0,
    ) -> KaraokeSearchResult:
        """Return one page of matches, with the count of everything behind it."""
        normalized = query.strip()
        if not normalized:
            return KaraokeSearchResult(entries=[], total=0)

        entries = await self._ranked_entries(normalized)
        return KaraokeSearchResult(entries=entries[offset:offset + limit], total=len(entries))

    async def _ranked_entries(self, query: str) -> list[KaraokeEntry]:
        """
        Every match for a query, in rank order.

        Cached whole rather than by page, so asking for more results costs
        nothing upstream and the ranking cannot shift under a singer part way
        down the list.
        """
        if self.cache:
            cached = self.cache.get_search_results(query)
            if cached is not None:
                try:
                    return [KaraokeEntry(**entry) for entry in cached.get("entries", [])]
                except (ValidationError, TypeError) as e:
                    print(f"[SERVICE] Discarding cached results for {query!r}: {e}")

        all_entries = []
        for provider in self.source_providers:
            result = await provider.search(query)
            all_entries.extend(result.entries)

        # An empty result is usually a provider that just failed rather than a
        # song nobody has uploaded, and caching it holds the failure open long
        # after it clears.
        if self.cache and all_entries:
            self.cache.cache_search_results(
                query,
                {"entries": [entry.model_dump() for entry in all_entries]},
                SEARCH_CACHE_TTL_SECONDS,
            )

        return all_entries

    async def get_video_url(self, entry: KaraokeEntry) -> VideoURLResponse:
        """Get video URL for an entry using the appropriate provider based on source field"""
        # Return existing URL if already present
        if entry.video_url:
            return VideoURLResponse(video_url=entry.video_url)
        elif self.cache:
            cached_url = self.cache.get_video_url(entry.id, entry.source)
            if cached_url is not None:
                return VideoURLResponse(video_url=cached_url if cached_url else None)

        result = None
        for provider in self.source_providers:
            if provider.provider_id == entry.source:
                try:
                    got_result = await provider.get_video_url(entry)
                    result = VideoURLResult(video_url=got_result, cacheable=True) if isinstance(got_result, str) else got_result
                except Exception as e:
                    print(f"[SERVICE] Provider {provider.provider_id} failed for {entry.id}: {e}")
                    return VideoURLResponse(video_url=None)

        # Cache the result (if cache available and cacheable)
        if result and self.cache and result.cacheable:
            self.cache.cache_video_url(
                entry.id,
                entry.source,
                result.video_url or "",
                result.cache_ttl_seconds
            )

        if result is None:
            return VideoURLResponse(video_url=None)
        
        return VideoURLResponse(video_url=result.video_url)
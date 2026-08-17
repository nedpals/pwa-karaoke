from pydantic import BaseModel
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

    async def report_playback_failure(self, entry: KaraokeEntry, diagnostics: dict) -> bool:
        """
        Hand a client side playback failure to the provider that produced the
        URL, and drop the cached URL when that provider says it is dead.

        Without this a URL the client could not play stays cached for its full
        TTL, so every retry of that song gets the same dead URL.
        """
        for provider in self.source_providers:
            if provider.provider_id != entry.source:
                continue

            try:
                should_invalidate = await provider.report_playback_failure(entry, diagnostics)
            except Exception as e:
                print(f"[SERVICE] Provider {provider.provider_id} failed to handle a playback failure: {e}")
                return False

            if should_invalidate and self.cache:
                self.cache.invalidate_video_url(entry.id, entry.source)
            return should_invalidate

        return False

    async def search(self, query: str):
        # Direct search without caching for now
        # TODO: Implement semantic search caching that can match similar queries
        all_entries = []
        for provider in self.source_providers:
            result = await provider.search(query)
            all_entries.extend(result.entries)
        return KaraokeSearchResult(entries=all_entries)

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
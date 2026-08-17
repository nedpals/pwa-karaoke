import asyncio

from pydantic import BaseModel, ValidationError
from typing_extensions import Annotated
from fastapi import Depends

from core.ranking import is_singable, query_tokens, score_candidate
from core.search import (
    KaraokeSearchResult,
    KaraokeEntry,
    KaraokeSourceProvider,
    SearchCandidate,
)
from source_providers.registry import build_registry
from cache_store import get_cache_store, CacheStore
from config import config

# Built once and shared. KaraokeService is constructed through Depends on every
# call, so anything a provider accumulates (health, sessions, rate limit state)
# would otherwise reset each time.
SOURCE_REGISTRY = build_registry(config.KARAOKE_SOURCES)

SEARCH_CACHE_TTL_SECONDS = 30 * 60

DEFAULT_SEARCH_LIMIT = 12
MAX_SEARCH_LIMIT = 50


class VideoURLResponse(BaseModel):
    video_url: str | None
    audio_url: str | None = None


class ProviderSearchOutcome:
    def __init__(self, provider: KaraokeSourceProvider, candidates: list[SearchCandidate], ok: bool):
        self.provider = provider
        self.candidates = candidates
        self.ok = ok


class KaraokeService:
    def __init__(self, cache: Annotated[CacheStore, Depends(get_cache_store)] = None):
        self.providers = SOURCE_REGISTRY
        self.cache = cache

    async def get_health(self) -> dict:
        """
        Per-provider health, plus whether any provider can still resolve a
        video. Playback is only impossible once every provider is down.
        """
        providers = {}
        for provider in self.providers.all():
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

    async def _search_provider(self, provider: KaraokeSourceProvider, query: str) -> ProviderSearchOutcome:
        """A source that is down costs the others nothing but the results it owed."""
        try:
            return ProviderSearchOutcome(provider, await provider.search(query), True)
        except Exception as e:
            detail = str(e) or type(e).__name__
            provider.health.record_failure(detail)
            print(f"[SERVICE] Search failed for {provider.provider_id}: {detail}")
            return ProviderSearchOutcome(provider, [], False)

    async def _ranked_entries(self, query: str) -> list[KaraokeEntry]:
        """
        Every match for a query, in rank order.

        Cached whole rather than by page, so asking for more results costs
        nothing upstream and the ranking cannot shift under a singer part way
        down the list.
        """
        if self.cache:
            cached = self.cache.get_search_results(query, scope=self._cache_scope())
            if cached is not None:
                try:
                    return [KaraokeEntry(**entry) for entry in cached.get("entries", [])]
                except (ValidationError, TypeError) as e:
                    print(f"[SERVICE] Discarding cached results for {query!r}: {e}")

        providers = self.providers.all()
        outcomes = await asyncio.gather(*(self._search_provider(p, query) for p in providers))

        tokens = query_tokens(query)
        scored: list[tuple[float, KaraokeEntry]] = []
        seen: set[tuple[str, str]] = set()

        for outcome in outcomes:
            provider = outcome.provider
            for candidate in outcome.candidates:
                key = (candidate.entry.source, candidate.entry.id)
                if key in seen:
                    continue

                if not is_singable(candidate, provider.min_duration_seconds, provider.max_duration_seconds):
                    continue

                seen.add(key)
                scored.append((
                    score_candidate(candidate, tokens, curated=provider.curated),
                    candidate.entry,
                ))

        # A stable sort leaves equally scored results in registry order.
        scored.sort(key=lambda ranked: ranked[0], reverse=True)
        entries = [entry for _, entry in scored]

        # A partial result caches a source's outage for the next half hour, and
        # an empty one is usually a failure rather than a song nobody uploaded.
        if self.cache and entries and all(outcome.ok for outcome in outcomes):
            self.cache.cache_search_results(
                query,
                {"entries": [entry.model_dump() for entry in entries]},
                SEARCH_CACHE_TTL_SECONDS,
                scope=self._cache_scope(),
            )

        return entries

    def _cache_scope(self) -> str:
        """Without this, a page built while a source was down outlives its recovery."""
        return ",".join(sorted(self.providers.ids))

    async def get_video_url(self, entry: KaraokeEntry, refresh: bool = False) -> VideoURLResponse:
        """
        Resolve a playable URL through the provider that owns the entry.

        `refresh` re-resolves even when a URL is already in hand, for the case
        where the one we have has stopped playing. Provider URLs expire, so a
        cached copy of a dead link is worse than none.
        """
        if refresh:
            if self.cache:
                self.cache.invalidate_media_urls(entry.id, entry.source)
            # Both tracks, or a paired entry keeps its audio and short-circuits
            # the re-resolution below with half of a dead result.
            entry = entry.model_copy(update={"video_url": None, "audio_url": None})

        # Either track alone counts as resolved: an audio-only source leaves
        # video_url unset, and the two always travel together.
        if entry.video_url or entry.audio_url:
            return VideoURLResponse(video_url=entry.video_url, audio_url=entry.audio_url)

        if self.cache:
            cached = self.cache.get_media_urls(entry.id, entry.source)
            if cached is not None:
                return VideoURLResponse(video_url=cached.video_url, audio_url=cached.audio_url)

        provider = self.providers.get(entry.source)
        if provider is None:
            print(f"[SERVICE] No provider registered for source {entry.source!r}")
            return VideoURLResponse(video_url=None)

        try:
            result = await provider.get_video_url(entry)
        except Exception as e:
            print(f"[SERVICE] Provider {provider.provider_id} failed for {entry.id}: {e}")
            provider.health.record_failure(str(e))
            return VideoURLResponse(video_url=None)

        if self.cache and result.cacheable:
            self.cache.cache_media_urls(
                entry.id,
                entry.source,
                result.video_url,
                result.audio_url,
                result.cache_ttl_seconds
            )

        return VideoURLResponse(video_url=result.video_url, audio_url=result.audio_url)

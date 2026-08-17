from typing import Callable, Optional

from core.search import KaraokeSourceProvider
from source_providers.youtube import YTKaraokeSourceProvider

PROVIDER_FACTORIES: dict[str, Callable[[], KaraokeSourceProvider]] = {
    "youtube": YTKaraokeSourceProvider,
}


class ProviderRegistry:
    """
    The set of providers a running server searches, built once and shared so
    that health, sessions and rate limit state survive between requests.
    """

    def __init__(self, providers: list[KaraokeSourceProvider]):
        self._by_id: dict[str, KaraokeSourceProvider] = {}
        for provider in providers:
            provider_id = provider.provider_id
            if provider_id in self._by_id:
                raise ValueError(f"Duplicate provider_id {provider_id!r}")
            self._by_id[provider_id] = provider

    def __len__(self) -> int:
        return len(self._by_id)

    @property
    def ids(self) -> list[str]:
        return list(self._by_id)

    def all(self) -> list[KaraokeSourceProvider]:
        return list(self._by_id.values())

    def get(self, provider_id: str) -> Optional[KaraokeSourceProvider]:
        return self._by_id.get(provider_id)

    async def close(self):
        for provider in self._by_id.values():
            try:
                await provider.close()
            except Exception as e:
                print(f"[SOURCES] Failed to close {provider.provider_id}: {e}")


def build_registry(enabled: Optional[list[str]] = None) -> ProviderRegistry:
    """
    Build from a list of provider IDs, or every known provider when empty. An
    unknown ID is fatal so a typo surfaces at startup, not as a missing source.
    """
    if not enabled:
        return ProviderRegistry([factory() for factory in PROVIDER_FACTORIES.values()])

    unknown = [name for name in enabled if name not in PROVIDER_FACTORIES]
    if unknown:
        known = ", ".join(sorted(PROVIDER_FACTORIES))
        raise ValueError(f"Unknown karaoke sources {unknown}. Known sources: {known}")

    return ProviderRegistry([PROVIDER_FACTORIES[name]() for name in enabled])

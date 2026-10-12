import pytest
from fastapi.testclient import TestClient

from cache_store import CacheStore, clear_cache_store, set_cache_store
from main import app


@pytest.fixture
def client():
    # Skips the app lifespan, which checks yt-dlp over the network
    cache = CacheStore()
    set_cache_store(cache)
    yield TestClient(app)
    cache.cleanup()
    clear_cache_store()

import pytest

import cache_store
from cache_store import CacheStore


@pytest.fixture
def store():
    cache = CacheStore()
    yield cache
    cache.cleanup()


@pytest.fixture
def clock(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(cache_store.time, "time", lambda: now[0])
    return now


def test_stores_and_reads_search_results_and_video_urls(store, clock):
    results = {"entries": [{"id": "song-1", "title": "Song A"}], "total": 1}

    store.cache_search_results("queen", results, ttl_seconds=10)
    store.cache_video_url("song-1", "youtube", "https://video.test/song-1", ttl_seconds=10)

    assert store.get_search_results("QUEEN") == results
    assert store.get_video_url("song-1", "youtube") == "https://video.test/song-1"


def test_returns_none_for_unknown_keys(store, clock):
    assert store.get_search_results("missing") is None
    assert store.get_video_url("missing", "youtube") is None


def test_expired_entries_are_not_returned(store, clock):
    store.cache_search_results("queen", {"entries": []}, ttl_seconds=10)
    store.cache_video_url("song-1", "youtube", "https://video.test/song-1", ttl_seconds=10)

    clock[0] += 11

    assert store.get_search_results("queen") is None
    assert store.get_video_url("song-1", "youtube") is None

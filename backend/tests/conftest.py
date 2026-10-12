import importlib.util
import sys
import types

import pytest
from fastapi.testclient import TestClient

# The YouTube provider imports yt_dlp at the top of its file, but only uses it
# when it actually searches. CI does not install it, so a placeholder is enough.
if importlib.util.find_spec("yt_dlp") is None:
    sys.modules["yt_dlp"] = types.ModuleType("yt_dlp")

from cache_store import CacheStore, clear_cache_store, set_cache_store  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture
def client():
    # Not used as a context manager on purpose. That would run the app's
    # startup code, which checks yt-dlp and needs the network.
    # The cache is set up by hand here for the same reason.
    cache = CacheStore()
    set_cache_store(cache)
    yield TestClient(app)
    cache.cleanup()
    clear_cache_store()

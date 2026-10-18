import asyncio

import pytest

from core.search import KaraokeEntry
from source_providers import youtube
from source_providers.youtube import YTKaraokeSourceProvider, YtdlpError

BOT_CHECK = "ERROR: [youtube] abc: Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies"
FORMAT_WITHHELD = "ERROR: [youtube] abc: Requested format is not available. Use --list-formats for a list of available formats"
PRIVATE_VIDEO = "ERROR: [youtube] abc: Private video. Sign in if you've been granted access to this video"


def ytdlp_failure(stderr: str) -> YtdlpError:
    return YtdlpError("yt-dlp exited with code 1", returncode=1, stderr=stderr)


def make_entry() -> KaraokeEntry:
    return KaraokeEntry(
        id="abc",
        title="My Way",
        artist="Test Artist",
        source="youtube",
        uploader="Test Channel",
        duration=240.0,
    )


@pytest.fixture
def no_retry_delay(monkeypatch):
    async def instant(_seconds):
        return None

    monkeypatch.setattr(youtube.asyncio, "sleep", instant)


def resolve_with_errors(monkeypatch, *stderrs: str):
    errors = iter(stderrs)

    async def failing_ytdlp_json(_args, timeout=None):
        raise ytdlp_failure(next(errors))

    monkeypatch.setattr(youtube, "ytdlp_json", failing_ytdlp_json)
    provider = YTKaraokeSourceProvider()
    result = asyncio.run(provider.get_video_url(make_entry()))
    return provider, result


@pytest.mark.parametrize("stderr", [BOT_CHECK, FORMAT_WITHHELD])
def test_youtube_blocking_counts_as_environmental(stderr):
    assert YTKaraokeSourceProvider._is_environmental(ytdlp_failure(stderr))


def test_private_video_is_an_answer_about_the_video():
    assert not YTKaraokeSourceProvider._is_environmental(ytdlp_failure(PRIVATE_VIDEO))


def test_withheld_formats_after_a_bot_check_are_not_cached(monkeypatch, no_retry_delay):
    provider, result = resolve_with_errors(
        monkeypatch, BOT_CHECK, FORMAT_WITHHELD, FORMAT_WITHHELD, FORMAT_WITHHELD
    )

    assert result.video_url is None
    assert not result.cacheable
    assert provider.health.snapshot()["consecutive_failures"] > 0


def test_private_video_is_cached_as_unavailable(monkeypatch, no_retry_delay):
    _, result = resolve_with_errors(monkeypatch, PRIVATE_VIDEO)

    assert result.video_url is None
    assert result.cacheable

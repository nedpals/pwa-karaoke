import asyncio
import json
import os
import random
import shlex
import time
from concurrent.futures import ThreadPoolExecutor
from typing import NamedTuple, Optional, Union
from urllib.parse import urlparse, urlunparse

import yt_dlp

from core.search import KaraokeSourceProvider, KaraokeSearchResult, KaraokeEntry, VideoURLResult, ProviderHealth
from config import config

PLAYER_CLIENT = "android_sdkless"
FORMAT_SELECTOR = "best[ext=mp4]/best[ext=webm]/best"

# Words that mark a query as already asking for a karaoke cut. "videoke" and
# "minus one" are here because they are what a lot of people actually type.
KARAOKE_QUERY_KEYWORDS = (
    "karaoke", "instrumental", "backing track", "sing along", "videoke", "minus one",
)

# Applied to every CLI invocation. --ignore-config keeps a stray user or system
# config file from changing behaviour under us.
YTDLP_BASE_ARGS = [
    "--ignore-config",
    "--quiet",
    "--no-warnings",
    "--no-progress",
    "--no-playlist",
]

RETRYABLE_ERROR_MARKERS = (
    "proxy", "407", "429", "rate limit",
    "connection", "timeout", "timed out", "network",
    "dns", "name resolution", "unreachable", "reset by peer", "temporary failure",
    "400", "401", "403", "404", "408",
)

KILL_GRACE_SECONDS = 5.0

# How long a failed probe is trusted before /health tries again.
PROBE_INTERVAL_SECONDS = 60.0


class YtdlpError(Exception):
    def __init__(self, message: str, returncode: Optional[int] = None, stderr: str = ""):
        super().__init__(message)
        self.returncode = returncode
        self.stderr = stderr

    @property
    def details(self) -> str:
        return f"{self} {self.stderr}".strip()


class YtdlpTimeout(YtdlpError):
    pass


class YtdlpMissing(YtdlpError):
    pass


class ExtractionOutcome(NamedTuple):
    url: Optional[str]
    # True when the attempt failed for a reason that says nothing about this
    # particular video, so the result is not worth remembering.
    environmental_failure: bool


class YtdlpHealth(ProviderHealth):
    """
    Provider health backed by a version probe of the yt-dlp binary.

    Starts unavailable because the binary has to be confirmed before anything
    can be resolved.
    """

    def __init__(self):
        super().__init__(available=False)
        self.last_probe_at: float = 0.0
        self._lock = asyncio.Lock()

    async def probe(self, force: bool = False) -> dict:
        """
        Refresh the version probe.

        Skipped while the binary is known good and rate limited otherwise, so
        /health can call it on every request. Probing on the way back up is what
        lets an install into a running container recover without a restart.
        """
        if not force and self.available and self.version:
            return self.snapshot()

        async with self._lock:
            if not force and self.available and self.version:
                return self.snapshot()

            now = time.time()
            if not force and now - self.last_probe_at < PROBE_INTERVAL_SECONDS:
                return self.snapshot()
            self.last_probe_at = now

            try:
                self.record_ok(version=await ytdlp_version())
            except YtdlpError as e:
                self.record_failure(e.details, fatal=True)

        return self.snapshot()


def proxy_url() -> Optional[str]:
    """Build the configured proxy URL, with credentials when both are set."""
    if not config.PROXY_SERVER:
        return None

    if not (config.PROXY_USERNAME and config.PROXY_PASSWORD):
        return config.PROXY_SERVER

    parsed = urlparse(config.PROXY_SERVER)
    netloc = f"{config.PROXY_USERNAME}:{config.PROXY_PASSWORD}@{parsed.hostname}"
    if parsed.port:
        netloc = f"{netloc}:{parsed.port}"

    return urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))


def _subprocess_env() -> dict:
    """
    Pass the proxy through the environment rather than argv so credentials stay
    out of the host process list.
    """
    env = os.environ.copy()
    proxy = proxy_url()
    if proxy:
        for key in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"):
            env[key] = proxy
    return env


async def _terminate(proc: asyncio.subprocess.Process):
    if proc.returncode is not None:
        return

    try:
        proc.kill()
    except ProcessLookupError:
        return

    try:
        await asyncio.wait_for(proc.wait(), timeout=KILL_GRACE_SECONDS)
    except asyncio.TimeoutError:
        print(f"[YTDLP] Process {proc.pid} did not exit after kill")


async def run_ytdlp(args: list[str], timeout: Optional[float] = None) -> str:
    """
    Run the yt-dlp CLI and return its stdout, raising YtdlpError on any failure.

    Shelling out keeps this on yt-dlp's documented command line contract rather
    than its Python internals, which matters because the package is upgraded
    often. It also allows the hard timeout below, which the in-process API has
    no equivalent for, and keeps extractor crashes out of the server.
    """
    argv = [config.YTDLP_BINARY, *YTDLP_BASE_ARGS]
    if config.YTDLP_EXTRA_ARGS:
        argv.extend(shlex.split(config.YTDLP_EXTRA_ARGS))
    argv.extend(args)

    limit = timeout if timeout is not None else config.YTDLP_TIMEOUT_SECONDS

    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=_subprocess_env(),
        )
    except FileNotFoundError as e:
        raise YtdlpMissing(f"yt-dlp binary not found at {config.YTDLP_BINARY!r}") from e
    except OSError as e:
        raise YtdlpError(f"Failed to start yt-dlp: {e}") from e

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=limit)
    except asyncio.TimeoutError:
        await _terminate(proc)
        raise YtdlpTimeout(f"yt-dlp timed out after {limit:g}s")
    except asyncio.CancelledError:
        await _terminate(proc)
        raise

    if proc.returncode != 0:
        raise YtdlpError(
            f"yt-dlp exited with code {proc.returncode}",
            returncode=proc.returncode,
            stderr=stderr.decode("utf-8", errors="replace").strip(),
        )

    return stdout.decode("utf-8", errors="replace")


async def ytdlp_json(args: list[str], timeout: Optional[float] = None) -> dict:
    """Run yt-dlp in simulate mode and return the parsed info dictionary."""
    stdout = await run_ytdlp(["--dump-single-json", "--skip-download", *args], timeout=timeout)

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as e:
        raise YtdlpError(f"yt-dlp returned output that is not valid JSON: {e}") from e


async def ytdlp_version(timeout: float = 15.0) -> str:
    return (await run_ytdlp(["--version"], timeout=timeout)).strip()


def select_stream_url(info: dict) -> Optional[str]:
    """
    Pull the resolved stream URL out of an info dictionary.

    requested_downloads reflects the selected format, so prefer it and fall
    back to the top level url that other output shapes carry.
    """
    if not isinstance(info, dict):
        return None

    for download in info.get("requested_downloads") or []:
        if isinstance(download, dict) and download.get("url"):
            return download["url"]

    return info.get("url")


class YTKaraokeSourceProvider(KaraokeSourceProvider):
    def __init__(self, allowed_channels: list[str] = None, karaoke_keywords: list[str] = None):
        super().__init__()
        self.health = YtdlpHealth()
        # Examples: ["KaraFun", "Sing King", "Lucky Voice", "Karaoke Mugen"]
        self.allowed_channels = allowed_channels or []
        # The first is what gets appended to a query that carries none of them;
        # the rest are only ever recognised.
        self.karaoke_keywords = karaoke_keywords or list(KARAOKE_QUERY_KEYWORDS)

    @property
    def provider_id(self) -> str:
        return "youtube"

    async def check_health(self) -> dict:
        return await self.health.probe()


    @staticmethod
    def _thumbnail_url(video_id: str) -> Optional[str]:
        """
        The thumbnails yt-dlp returns for a flat search carry signed sqp query
        params that expire. This unsigned form stays valid.
        """
        if not video_id:
            return None
        return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    def _get_ydl_opts(self) -> dict:
        """
        Options for the in-process search path. Search stays on the library
        because it runs on the interactive path, where a process spawn per
        keystroke would be felt, and because a flat search returns a far more
        stable shape than a full extraction.
        """
        opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'noplaylist': True,
            'extractor_args': {
                'youtube': {
                    'player_client': [PLAYER_CLIENT]
                }
            },
        }

        proxy = proxy_url()
        if proxy:
            opts['proxy'] = proxy

        return opts

    def _search_videos(self, query: str, max_results: int = 10) -> list[KaraokeEntry]:
        """Search for videos using yt-dlp's ytsearch functionality."""
        ydl_opts = self._get_ydl_opts()
        entries = []

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # Use ytsearch to get multiple results
                search_query = f"ytsearch{max_results}:{query}"
                search_results = ydl.extract_info(search_query, download=False)

                if not search_results or 'entries' not in search_results:
                    return entries

                for video_info in search_results['entries']:
                    if not video_info:
                        continue

                    # Filter by allowed channels if specified
                    uploader = video_info.get('uploader', '')
                    if self.allowed_channels and not self._is_allowed_channel(uploader):
                        continue

                    video_id = video_info.get('id', '')

                    entries.append(KaraokeEntry(
                        id=video_id,
                        title=video_info.get('title', 'Unknown Title'),
                        artist=uploader,
                        video_url=None,  # Will be loaded on demand
                        source=self.provider_id,
                        uploader=uploader,
                        duration=video_info.get('duration'),
                        thumbnail_url=self._thumbnail_url(video_id)
                    ))

        except Exception as e:
            print(f"Search failed: {e}")

        return entries

    async def search(self, query: str) -> KaraokeSearchResult:
        try:
            enhanced_query = self._enhance_query_with_keywords(query)
            loop = asyncio.get_event_loop()
            if not loop.is_running():
                return KaraokeSearchResult(entries=[])
            with ThreadPoolExecutor() as executor:
                # Run the search in a thread to avoid blocking the event loop
                entries = await loop.run_in_executor(executor, self._search_videos, enhanced_query)
            return KaraokeSearchResult(entries=entries)

        except Exception as e:
            print(f"Search failed: {e}")
            return KaraokeSearchResult(entries=[])


    def _enhance_query_with_keywords(self, query: str) -> str:
        """
        Steer a search towards karaoke cuts without drowning out the song.

        YouTube has no boolean search operators, so a list of alternatives is
        read as more words to match rather than a choice between them. Spending
        four of them on keywords leaves the song title outweighed, and the
        results drift onto whatever else the keywords match: searching "my way"
        that way returned ABBA and Toni Braxton in the top ten. One keyword,
        added only when the query carries none, narrows the search instead.
        """
        if not self.karaoke_keywords:
            return query

        lowered = query.lower()
        if any(keyword in lowered for keyword in self.karaoke_keywords):
            return query

        return f"{query} {self.karaoke_keywords[0]}"

    def _is_allowed_channel(self, channel_name: str) -> bool:
        if not self.allowed_channels:
            return True
        return any(allowed.lower() in channel_name.lower() for allowed in self.allowed_channels)

    async def get_video_url(self, entry: KaraokeEntry) -> Union[str, VideoURLResult, None]:
        """
        Fetch the actual video URL for a YouTube entry on demand.

        Args:
            entry: KaraokeEntry with YouTube video ID as the id

        Returns:
            VideoURLResult with YouTube-specific cache settings, or None if not available
        """
        if not entry.id:
            return None  # No video ID

        # Construct YouTube URL from video ID
        youtube_url = f"https://www.youtube.com/watch?v={entry.id}"
        outcome = await self._get_raw_video_url(youtube_url)

        if outcome.url:
            return VideoURLResult(
                video_url=outcome.url,
                cache_ttl_seconds=4 * 3600,  # 4 hours - YouTube URLs are stable
                cacheable=True
            )

        # A missing binary, a timeout or a blocked proxy is our problem, not
        # this video's. Caching it would keep the song unplayable for another
        # 30 minutes after the cause is fixed, so let the next attempt retry.
        return VideoURLResult(
            video_url=None,
            cache_ttl_seconds=30 * 60,  # 30 minutes for failures
            cacheable=not outcome.environmental_failure
        )

    @staticmethod
    def _is_environmental(error: Exception) -> bool:
        """
        Whether a failure is about the extractor or the network rather than
        the video itself. A private or deleted video is a stable answer worth
        caching; a dead proxy is not.
        """
        if isinstance(error, (YtdlpMissing, YtdlpTimeout)):
            return True

        if isinstance(error, YtdlpError):
            # No exit code means yt-dlp never ran or never produced usable output.
            if error.returncode is None:
                return True
            details = error.details
        else:
            details = str(error)

        return any(marker in details.lower() for marker in RETRYABLE_ERROR_MARKERS)

    @classmethod
    def _should_retry(cls, error: Exception) -> bool:
        # A missing binary will not appear part way through the loop, so
        # retrying only delays the failure.
        if isinstance(error, YtdlpMissing):
            return False
        return cls._is_environmental(error)

    async def _get_raw_video_url(self, youtube_url: str, max_retries: int = 3, base_delay: float = 1.0) -> ExtractionOutcome:
        """
        Extract raw video URL by running the yt-dlp CLI.
        Returns the best quality video stream URL.

        Every attempt is bounded by the wrapper's timeout, so a hung extraction
        releases the request instead of pinning it until yt-dlp gives up on its
        own. yt-dlp's internal retries are kept low for the same reason.
        """
        for attempt in range(max_retries + 1):
            try:
                info = await ytdlp_json([
                    "--format", FORMAT_SELECTOR,
                    "--socket-timeout", "15",
                    "--retries", "1",
                    "--extractor-args", f"youtube:player_client={PLAYER_CLIENT}",
                    youtube_url,
                ])
                self.health.record_ok()
                return ExtractionOutcome(select_stream_url(info), False)

            except YtdlpMissing as e:
                self.health.record_failure(str(e), fatal=True)
                print(f"[YTDLP] {e}")
                return ExtractionOutcome(None, True)

            except Exception as e:
                environmental = self._is_environmental(e)
                detail = e.details if isinstance(e, YtdlpError) else str(e)

                if attempt < max_retries and self._should_retry(e):
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    print(f"[YTDLP] Attempt {attempt + 1} failed for {youtube_url}: {detail}")
                    print(f"[YTDLP] Retrying in {delay:.1f} seconds...")
                    await asyncio.sleep(delay)
                    continue

                if environmental:
                    self.health.record_failure(detail, fatal=isinstance(e, YtdlpMissing))
                else:
                    # yt-dlp ran and gave a verdict on the video, so the
                    # extractor itself is working.
                    self.health.record_ok()

                print(f"[YTDLP] Failed to extract video URL for {youtube_url} after {attempt + 1} attempts")
                print(f"[YTDLP] Final error: {detail}")
                return ExtractionOutcome(None, environmental)

        return ExtractionOutcome(None, True)

    async def close(self):
        # No cleanup needed for yt-dlp
        pass

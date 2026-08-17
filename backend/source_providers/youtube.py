import asyncio
import json
import math
import os
import re
import random
import shlex
import time
from typing import NamedTuple, Optional, Union
from urllib.parse import urlparse, urlunparse

import yt_dlp

from core.search import KaraokeSourceProvider, KaraokeSearchResult, KaraokeEntry, VideoURLResult, ProviderHealth
from config import config

PLAYER_CLIENT = "android_sdkless"
FORMAT_SELECTOR = "best[ext=mp4]/best[ext=webm]/best"

# A karaoke display gains nothing above 1080p, and the 1440p/2160p rungs are
# AV1-only, which cheap TV browsers and SBCs cannot decode in real time.
MAX_VIDEO_HEIGHT = 1080

# avc1 is hardware-decoded essentially everywhere; av01 rarely is.
VIDEO_CODEC_PREFERENCE = ("avc1", "vp09", "vp9", "av01")

# Words that mark a query as already asking for a karaoke cut.
KARAOKE_QUERY_KEYWORDS = (
    "karaoke", "instrumental", "backing track", "sing along", "videoke", "minus one",
)

# Sixty results cost about half a second more than thirty, and they are what
# the ranking, and the pages after the first, have to work with.
SEARCH_FETCH_LIMIT = 60
SEARCH_POOL_LIMIT = 48

SEARCH_SOCKET_TIMEOUT_SECONDS = 15

# Below the floor sit isolated solo backing tracks, above the ceiling sit
# hour-long nonstop medleys.
MIN_DURATION_SECONDS = 90
MAX_DURATION_SECONDS = 15 * 60

KARAOKE_TITLE_MARKERS = KARAOKE_QUERY_KEYWORDS + (
    "sing-along", "no vocal", "lyrics on screen", "karaoke version",
)

# Shapes that match the song but are not something to sing over.
NON_KARAOKE_TITLE_MARKERS = (
    "official video", "official music video", "official lyric", "lyric video",
    "(lyrics)", "reaction", "live performance", "behind the scenes",
    "tutorial", "how to", "review", "full album", "medley", "nonstop",
    "compilation",
)

KARAOKE_CHANNEL_MARKERS = (
    "karaoke", "videoke", "sing king", "karafun", "singalong", "sing along",
)

TITLE_MARKER_WEIGHT = 3.0
NON_KARAOKE_PENALTY = 3.0
KARAOKE_CHANNEL_WEIGHT = 2.0
VERIFIED_CHANNEL_WEIGHT = 1.5
# Damped by a log and capped, so a well known track edges out an equally
# karaoke one without burying it.
POPULARITY_WEIGHT = 0.4
POPULARITY_CEILING = 7.0
# YouTube's own ordering stays the baseline; a result has to earn its way off it.
POSITION_PENALTY = 0.15
# Outweighs the rest, or a karaoke channel's most popular upload outranks the
# song that was actually asked for.
QUERY_MATCH_WEIGHT = 6.0

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
    # When set, `url` carries no audio of its own and the two play together.
    audio_url: Optional[str] = None


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


def _format_rank(fmt: dict) -> tuple:
    return (fmt.get("height") or 0, fmt.get("tbr") or 0, fmt.get("abr") or 0)


def _pick_format(formats: list[dict], preferred_exts: tuple[str, ...]) -> Optional[str]:
    """Container preference wins over quality, mirroring FORMAT_SELECTOR's chain."""
    for ext in preferred_exts + (None,):
        candidates = [f for f in formats if ext is None or f.get("ext") == ext]
        if candidates:
            return max(candidates, key=_format_rank).get("url")
    return None


def _pick_video_only(formats: list[dict]) -> Optional[str]:
    """Decodability beats resolution: a hardware-decoded 720p plays, a 4K AV1 stutters."""
    for codec in VIDEO_CODEC_PREFERENCE:
        matching = [f for f in formats if (f.get("vcodec") or "").startswith(codec)]
        if matching:
            return max(matching, key=_format_rank).get("url")
    return max(formats, key=_format_rank).get("url") if formats else None


def select_stream_urls(info: dict) -> tuple[Optional[str], Optional[str]]:
    """
    Pull the resolved stream URLs out of an info dictionary.

    Returns (video_url, audio_url). A populated audio URL means the video URL
    carries no audio of its own and the two are meant to play together. That
    pairing is only used when the separate video track actually beats the muxed
    one, so nothing pays the sync cost for no quality gain: YouTube's muxed
    streams top out at 360p in practice while the adaptive ladder reaches 1080p.

    requested_downloads reflects the selected format, so it and the top level
    url remain the fallback for output shapes that carry no format list.
    """
    if not isinstance(info, dict):
        return None, None

    formats = [f for f in (info.get("formats") or []) if f.get("url")]

    muxed = [
        f for f in formats
        if f.get("vcodec", "none") != "none" and f.get("acodec", "none") != "none"
    ]
    audio_only = [
        f for f in formats
        if f.get("vcodec", "none") == "none" and f.get("acodec", "none") != "none"
    ]
    video_only = [
        f for f in formats
        if f.get("vcodec", "none") != "none" and f.get("acodec", "none") == "none"
    ]

    muxed_url = _pick_format(muxed, ("mp4", "webm"))
    # m4a before webm: Safari has no Opus-in-WebM support.
    audio_url = _pick_format(audio_only, ("m4a", "mp4", "webm"))

    best_muxed_height = max((f.get("height") or 0 for f in muxed), default=0)
    worthwhile = [
        f for f in video_only
        if best_muxed_height < (f.get("height") or 0) <= MAX_VIDEO_HEIGHT
    ]
    paired_video_url = _pick_video_only(worthwhile) if audio_url else None

    if paired_video_url:
        return paired_video_url, audio_url
    if muxed_url:
        return muxed_url, None
    if audio_url:
        return None, audio_url

    for download in info.get("requested_downloads") or []:
        if isinstance(download, dict) and download.get("url"):
            return download["url"], None

    return info.get("url"), None


def query_tokens(query: str) -> list[str]:
    return re.findall(r"\w+", query.lower(), flags=re.UNICODE)


def query_match_ratio(title: str, tokens: list[str]) -> float:
    if not tokens:
        return 1.0
    return sum(1 for token in tokens if token in title) / len(tokens)


def channel_name(info: dict) -> str:
    return info.get("channel") or info.get("uploader") or ""


def is_playable_entry(info: dict) -> bool:
    """
    Whether a search result is a single track someone can queue and sing.

    A live stream never ends and reports no duration, so it would stall the
    player once it reached the front of a queue.
    """
    if info.get("live_status") in ("is_live", "is_upcoming", "post_live"):
        return False

    duration = info.get("duration")
    if duration is None:
        return False

    return MIN_DURATION_SECONDS <= duration <= MAX_DURATION_SECONDS


def score_entry(info: dict, position: int, tokens: list[str]) -> float:
    """
    Rank a search result by how much it looks like a karaoke track.

    YouTube ranks for watching rather than for singing, so an official music
    video or a lyric video routinely outranks the karaoke cut of the same song.
    """
    title = (info.get("title") or "").lower()
    channel = channel_name(info).lower()

    score = QUERY_MATCH_WEIGHT * query_match_ratio(title, tokens)
    score += TITLE_MARKER_WEIGHT * sum(1 for marker in KARAOKE_TITLE_MARKERS if marker in title)
    score -= NON_KARAOKE_PENALTY * sum(1 for marker in NON_KARAOKE_TITLE_MARKERS if marker in title)

    if any(marker in channel for marker in KARAOKE_CHANNEL_MARKERS):
        score += KARAOKE_CHANNEL_WEIGHT

    if info.get("channel_is_verified"):
        score += VERIFIED_CHANNEL_WEIGHT

    views = info.get("view_count") or 0
    score += POPULARITY_WEIGHT * min(math.log10(views + 1), POPULARITY_CEILING)

    return score - POSITION_PENALTY * position


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
            'socket_timeout': SEARCH_SOCKET_TIMEOUT_SECONDS,
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

    def _search_videos(self, query: str, max_results: int = SEARCH_POOL_LIMIT) -> list[KaraokeEntry]:
        """
        Search YouTube and return the best karaoke candidates it offered.

        More results are fetched than are returned so that the unplayable and
        the merely song-shaped can be dropped without thinning the list.

        Takes the query as the singer typed it: the keyword added on the way to
        YouTube would otherwise count as a word every karaoke result matches.
        """
        ydl_opts = self._get_ydl_opts()
        tokens = query_tokens(query)
        ranked: list[tuple[float, KaraokeEntry]] = []
        seen: set[str] = set()

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                search_query = f"ytsearch{SEARCH_FETCH_LIMIT}:{self._enhance_query_with_keywords(query)}"
                search_results = ydl.extract_info(search_query, download=False)

                if not search_results or 'entries' not in search_results:
                    return []

                for position, video_info in enumerate(search_results['entries']):
                    if not video_info:
                        continue

                    video_id = video_info.get('id', '')
                    if not video_id or video_id in seen:
                        continue

                    if not is_playable_entry(video_info):
                        continue

                    uploader = channel_name(video_info)
                    if self.allowed_channels and not self._is_allowed_channel(uploader):
                        continue

                    seen.add(video_id)
                    ranked.append((score_entry(video_info, position, tokens), KaraokeEntry(
                        id=video_id,
                        title=video_info.get('title', 'Unknown Title'),
                        artist=uploader,
                        video_url=None,  # Will be loaded on demand
                        source=self.provider_id,
                        uploader=uploader,
                        duration=video_info.get('duration'),
                        thumbnail_url=self._thumbnail_url(video_id)
                    )))

        except Exception as e:
            print(f"Search failed: {e}")
            return []

        # A stable sort leaves equally scored results in YouTube's order.
        ranked.sort(key=lambda scored: scored[0], reverse=True)
        return [entry for _, entry in ranked[:max_results]]

    async def search(self, query: str) -> KaraokeSearchResult:
        """
        Search in a worker thread, bounded by SEARCH_TIMEOUT_SECONDS.

        The extraction path gets its hard limit from the CLI wrapper, but this
        one runs in process, where a stalled request would otherwise hold the
        controller on "Searching" for as long as yt-dlp took to give up.
        """
        try:
            entries = await asyncio.wait_for(
                asyncio.to_thread(self._search_videos, query),
                timeout=config.SEARCH_TIMEOUT_SECONDS,
            )
            return KaraokeSearchResult(entries=entries)

        except asyncio.TimeoutError:
            # The thread is left to unwind on its own; socket_timeout bounds it.
            print(f"[YTDLP] Search for {query!r} timed out after {config.SEARCH_TIMEOUT_SECONDS:g}s")
            return KaraokeSearchResult(entries=[])

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

        if outcome.url or outcome.audio_url:
            return VideoURLResult(
                video_url=outcome.url,
                audio_url=outcome.audio_url,
                cache_ttl_seconds=4 * 3600,  # 4 hours - YouTube URLs are stable
                cacheable=True
            )

        # A missing binary, a timeout or a blocked proxy is our problem, not
        # this video's. Caching it would keep the song unplayable for another
        # 30 minutes after the cause is fixed, so let the next attempt retry.
        return VideoURLResult(
            video_url=None,
            audio_url=None,
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
                video_url, audio_url = select_stream_urls(info)
                return ExtractionOutcome(video_url, False, audio_url)

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

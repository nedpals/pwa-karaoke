import asyncio
import json
import os
import random
import shlex
import time
from pathlib import Path
from typing import Callable, NamedTuple, Optional
from urllib.parse import urlparse, urlunparse

import yt_dlp

from core.ranking import KARAOKE_QUERY_KEYWORDS, enhance_query_with_keywords
from core.search import (
    KaraokeSourceProvider,
    KaraokeEntry,
    RankingSignals,
    SearchCandidate,
    VideoURLResult,
    ProviderHealth,
)
from config import config

# The player client decides which formats YouTube returns at all. Playback hands
# a single URL to a <video> element, so the only useful format is a progressive
# one: one file carrying both video and audio. Most clients no longer offer any,
# and yt-dlp does not treat an unknown client name as an error, it skips it with
# a warning and carries on with its own defaults. Changing this means reading
# the log for "Skipping unsupported client" and confirming a progressive format
# still comes back.
PLAYER_CLIENT = config.YTDLP_PLAYER_CLIENT

# Progressive, over plain HTTP. `best` alone already means muxed, but naming the
# constraint keeps the failure legible: when no progressive format exists the
# error is about this selector rather than about the video. HLS is excluded
# because a <video> element only plays it on Safari.
FORMAT_SELECTOR = (
    "best[protocol^=http][vcodec!=none][acodec!=none][ext=mp4]/"
    "best[protocol^=http][vcodec!=none][acodec!=none][ext=webm]/"
    "best[protocol^=http][vcodec!=none][acodec!=none]"
)

# Sixty results cost about half a second more than thirty, and they are what
# the ranking, and the pages after the first, have to work with.
SEARCH_FETCH_LIMIT = 60

SEARCH_SOCKET_TIMEOUT_SECONDS = 15

# Applied to every CLI invocation. --ignore-config keeps a stray user or system
# config file from changing behaviour under us. Warnings are deliberately left
# on: a skipped player client and a missing JS runtime both report themselves
# that way and are otherwise indistinguishable from a working extraction.
YTDLP_BASE_ARGS = [
    "--ignore-config",
    "--quiet",
    "--no-progress",
    "--no-playlist",
]

RETRYABLE_ERROR_MARKERS = (
    "proxy", "407", "429", "rate limit", "too many requests",
    "connection", "timeout", "timed out", "network",
    "dns", "name resolution", "unreachable", "reset by peer", "temporary failure",
    "400", "401", "403", "404", "408",
    # The source refusing this server, not a verdict on the video. Matched on
    # "not a bot" rather than "sign in", which a private video also says.
    "not a bot", "failed to extract any player response",
)

# Tags on the --print lines, so each can be told apart as it arrives.
DEST_PREFIX = "DEST "
SIZE_PREFIX = "SIZE "
DONE_PREFIX = "DONE "

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
        """Everything yt-dlp said, for the log."""
        return f"{self} {self.stderr}".strip()

    @property
    def failure_details(self) -> str:
        """
        What the run actually failed on, with the warnings dropped.

        Warnings are kept on for diagnosis, but they describe things yt-dlp
        recovered from, and they routinely name a 429 or a timeout. Reading
        them as the cause would make a private video look like a network blip
        and stop a permanent answer from ever being cached.
        """
        lines = [
            line.strip() for line in self.stderr.splitlines()
            if line.strip() and not line.strip().startswith("WARNING:")
        ]
        return f"{self} {' '.join(lines)}".strip()


class YtdlpTimeout(YtdlpError):
    pass


class YtdlpMissing(YtdlpError):
    pass


class ExtractionOutcome(NamedTuple):
    url: Optional[str]
    # True when the attempt failed for a reason that says nothing about this
    # particular video.
    environmental_failure: bool


def supported_player_client(client: str) -> Optional[bool]:
    """
    Whether yt-dlp recognises a player client, or None when it cannot be asked.

    Reads a private table, so a yt-dlp that moves it answers None rather than
    raising: the warnings from a real extraction remain the reliable signal, and
    this only exists to put the same news in /health and the startup log.
    """
    try:
        from yt_dlp.extractor.youtube._base import INNERTUBE_CLIENTS
    except Exception:
        return None

    return all(name.strip() in INNERTUBE_CLIENTS for name in client.split(",") if name.strip())


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
        self._warned_about_client = False

    def warn_if_client_unsupported(self):
        """
        Say so once when yt-dlp will not recognise the configured client.

        It would otherwise be skipped in silence and extraction would fall back
        to clients that offer no progressive format, which surfaces much later
        as songs that queue and never play.
        """
        if self._warned_about_client or supported_player_client(PLAYER_CLIENT) is not False:
            return

        self._warned_about_client = True
        print(
            f"[YTDLP] Player client {PLAYER_CLIENT!r} is not one yt-dlp knows. It will be "
            f"skipped and extraction will fall back to clients that may offer no playable "
            f"format. Set YTDLP_PLAYER_CLIENT to a supported client."
        )

    def snapshot(self) -> dict:
        # The client is the single setting most likely to be quietly wrong, and
        # the one that decides whether anything is playable at all.
        return {
            **super().snapshot(),
            "player_client": PLAYER_CLIENT,
            "player_client_supported": supported_player_client(PLAYER_CLIENT),
        }

    async def probe(self, force: bool = False) -> dict:
        """
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
                self.warn_if_client_unsupported()
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
    """Pass the proxy through the environment so credentials stay out of the host process list."""
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


def log_ytdlp_warnings(stderr: str):
    """
    Print yt-dlp's warnings from a run that otherwise succeeded.

    Several misconfigurations are visible nowhere else: an unsupported player
    client is skipped with a warning and the extraction then proceeds on
    whichever client yt-dlp would have chosen anyway, which looks like success
    until a video turns out to have no playable format.
    """
    seen = set()
    for line in stderr.splitlines():
        line = line.strip()
        if line.startswith("WARNING:") and line not in seen:
            seen.add(line)
            print(f"[YTDLP] {line}")


_js_runtime_flag: Optional[list[str]] = None
_js_runtime_lock = asyncio.Lock()


async def js_runtime_args() -> list[str]:
    """
    The --js-runtimes flag for the configured runtime, or nothing.

    yt-dlp enables only deno by default, so the Bun the image installs for this
    purpose goes unused unless it is named, and extraction quietly loses formats
    without it. The flag is recent and an unknown option fails every invocation,
    so it is confirmed against the binary once. Support for the flag is all this
    establishes; a runtime that is named but not installed reports itself in the
    warnings of the first real extraction.
    """
    global _js_runtime_flag

    if not config.YTDLP_RUNTIME:
        return []

    if _js_runtime_flag is None:
        async with _js_runtime_lock:
            if _js_runtime_flag is None:
                _js_runtime_flag = await _detect_js_runtime_flag()

    return _js_runtime_flag


async def _detect_js_runtime_flag() -> list[str]:
    flag = ["--js-runtimes", config.YTDLP_RUNTIME]
    try:
        await run_ytdlp([*flag, "--version"], timeout=15.0)
        print(f"[YTDLP] JavaScript runtime enabled: {config.YTDLP_RUNTIME}")
        return flag
    except YtdlpError as e:
        print(f"[YTDLP] This yt-dlp will not take --js-runtimes, continuing without it: {e.details}")
        return []


async def _spawn_ytdlp(args: list[str]) -> asyncio.subprocess.Process:
    argv = [config.YTDLP_BINARY, *YTDLP_BASE_ARGS]
    if config.YTDLP_EXTRA_ARGS:
        argv.extend(shlex.split(config.YTDLP_EXTRA_ARGS))
    argv.extend(args)

    try:
        return await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=_subprocess_env(),
        )
    except FileNotFoundError as e:
        raise YtdlpMissing(f"yt-dlp binary not found at {config.YTDLP_BINARY!r}") from e
    except OSError as e:
        raise YtdlpError(f"Failed to start yt-dlp: {e}") from e


async def run_ytdlp_streaming(
    args: list[str],
    on_line: Callable[[str], None],
    timeout: Optional[float] = None,
) -> list[str]:
    """
    Run yt-dlp, handing each stdout line to on_line as it arrives.

    run_ytdlp only sees output once the process has exited, which is no use for
    a download: what --print before_dl reports is worth having while the bytes
    are still arriving, not afterwards. yt-dlp does flush those lines
    immediately, so reading them live is enough to learn where a download is
    going and how big it will be.

    stderr is drained alongside rather than after, or a chatty run fills its
    pipe and the process blocks forever with neither side reading.
    """
    proc = await _spawn_ytdlp(args)
    limit = timeout if timeout is not None else config.YTDLP_TIMEOUT_SECONDS

    lines: list[str] = []
    errors: list[str] = []

    async def pump_stdout():
        while True:
            raw = await proc.stdout.readline()
            if not raw:
                return
            line = raw.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            lines.append(line)
            try:
                on_line(line)
            except Exception as e:
                print(f"[YTDLP] Output handler failed on {line!r}: {e}")

    async def pump_stderr():
        while True:
            raw = await proc.stderr.readline()
            if not raw:
                return
            errors.append(raw.decode("utf-8", errors="replace").rstrip())

    try:
        await asyncio.wait_for(
            asyncio.gather(pump_stdout(), pump_stderr(), proc.wait()),
            timeout=limit,
        )
    except asyncio.TimeoutError:
        await _terminate(proc)
        raise YtdlpTimeout(f"yt-dlp timed out after {limit:g}s")
    except asyncio.CancelledError:
        await _terminate(proc)
        raise

    stderr = "\n".join(errors).strip()
    if proc.returncode != 0:
        raise YtdlpError(
            f"yt-dlp exited with code {proc.returncode}",
            returncode=proc.returncode,
            stderr=stderr,
        )

    log_ytdlp_warnings(stderr)
    return lines


async def run_ytdlp(args: list[str], timeout: Optional[float] = None) -> str:
    """
    Run the yt-dlp CLI and return its stdout, raising YtdlpError on any failure.

    Shelling out keeps this on yt-dlp's documented command line contract rather
    than its Python internals, which matters because the package is upgraded
    often. It also allows the hard timeout below, which the in-process API has
    no equivalent for, and keeps extractor crashes out of the server.
    """
    limit = timeout if timeout is not None else config.YTDLP_TIMEOUT_SECONDS
    proc = await _spawn_ytdlp(args)

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=limit)
    except asyncio.TimeoutError:
        await _terminate(proc)
        raise YtdlpTimeout(f"yt-dlp timed out after {limit:g}s")
    except asyncio.CancelledError:
        await _terminate(proc)
        raise

    decoded_stderr = stderr.decode("utf-8", errors="replace").strip()

    if proc.returncode != 0:
        raise YtdlpError(
            f"yt-dlp exited with code {proc.returncode}",
            returncode=proc.returncode,
            stderr=decoded_stderr,
        )

    log_ytdlp_warnings(decoded_stderr)
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
    requested_downloads reflects the selected format, so prefer it and fall back
    to the top level url that other output shapes carry.
    """
    if not isinstance(info, dict):
        return None

    for download in info.get("requested_downloads") or []:
        if isinstance(download, dict) and download.get("url"):
            return download["url"]

    return info.get("url")


def channel_name(info: dict) -> str:
    return info.get("channel") or info.get("uploader") or ""


def is_live(info: dict) -> bool:
    return info.get("live_status") in ("is_live", "is_upcoming", "post_live")


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
        Search stays on the library because it runs on the interactive path,
        where a process spawn per keystroke would be felt, and because a flat
        search returns a far more stable shape than a full extraction.
        """
        # No JS runtime is named here: a flat search never calls the player API,
        # which is the only thing that needs one.
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

    def _search_videos(self, query: str) -> list[SearchCandidate]:
        ydl_opts = self._get_ydl_opts()
        candidates: list[SearchCandidate] = []
        seen: set[str] = set()

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            search_query = f"ytsearch{SEARCH_FETCH_LIMIT}:{self._enhance_query(query)}"
            search_results = ydl.extract_info(search_query, download=False)

            if not search_results or 'entries' not in search_results:
                return []

            for position, video_info in enumerate(search_results['entries']):
                if not video_info:
                    continue

                video_id = video_info.get('id', '')
                if not video_id or video_id in seen:
                    continue

                if is_live(video_info):
                    continue

                uploader = channel_name(video_info)
                if self.allowed_channels and not self._is_allowed_channel(uploader):
                    continue

                seen.add(video_id)
                candidates.append(SearchCandidate(
                    entry=KaraokeEntry(
                        id=video_id,
                        title=video_info.get('title', 'Unknown Title'),
                        artist=uploader,
                        video_url=None,  # Loaded on demand
                        source=self.provider_id,
                        uploader=uploader,
                        duration=video_info.get('duration'),
                        thumbnail_url=self._thumbnail_url(video_id),
                    ),
                    signals=RankingSignals(
                        position=position,
                        popularity=video_info.get('view_count') or 0,
                        verified=bool(video_info.get('channel_is_verified')),
                    ),
                ))

        return candidates

    async def search(self, query: str) -> list[SearchCandidate]:
        """
        Search in a worker thread, bounded by SEARCH_TIMEOUT_SECONDS.

        The extraction path gets its hard limit from the CLI wrapper, but this
        one runs in process, where a stalled request would otherwise hold the
        controller on "Searching" for as long as yt-dlp took to give up.
        """
        try:
            candidates = await asyncio.wait_for(
                asyncio.to_thread(self._search_videos, query),
                timeout=config.SEARCH_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            # The thread is left to unwind on its own; socket_timeout bounds it.
            raise YtdlpTimeout(f"Search timed out after {config.SEARCH_TIMEOUT_SECONDS:g}s")

        # Deliberately not recorded as health: search runs on the library and
        # extraction on the CLI binary, so a working search says nothing about
        # whether a queued song can actually be resolved.
        return candidates

    def _enhance_query(self, query: str) -> str:
        return enhance_query_with_keywords(query, self.karaoke_keywords)

    def _is_allowed_channel(self, channel_name: str) -> bool:
        if not self.allowed_channels:
            return True
        return any(allowed.lower() in channel_name.lower() for allowed in self.allowed_channels)

    async def get_video_url(self, entry: KaraokeEntry) -> VideoURLResult:
        if not entry.id:
            return VideoURLResult.unavailable()

        youtube_url = f"https://www.youtube.com/watch?v={entry.id}"
        outcome = await self._get_raw_video_url(youtube_url)

        if outcome.url:
            # YouTube's signed URLs outlive a sitting.
            return VideoURLResult.resolved(outcome.url, cache_ttl_seconds=4 * 3600)

        return VideoURLResult.failed() if outcome.environmental_failure else VideoURLResult.unavailable()

    async def download_video(
        self,
        entry: KaraokeEntry,
        work_dir: Path,
        on_start: Optional[Callable[[Path, Optional[int]], None]] = None,
    ) -> Optional[Path]:
        """
        Fetch the file itself rather than a URL to it, for the archive.

        Same format selector as playback, which under this player client is a
        progressive stream: one file, already muxed, so nothing has to be
        remuxed afterwards. --max-filesize makes yt-dlp skip a video that is
        larger than the cap instead of filling the disk to find out.
        """
        if not entry.id:
            return None

        youtube_url = f"https://www.youtube.com/watch?v={entry.id}"
        started = False
        destination: Optional[Path] = None
        finished: Optional[Path] = None

        def handle(line: str):
            # --no-part means the destination is written in place, so the path
            # reported here is the one that grows as the download runs.
            nonlocal started, destination, finished

            if line.startswith(DEST_PREFIX):
                destination = Path(line[len(DEST_PREFIX):].strip())
            elif line.startswith(SIZE_PREFIX):
                raw = line[len(SIZE_PREFIX):].strip()
                total = int(raw) if raw.isdigit() else None
                if on_start and not started and destination is not None:
                    started = True
                    on_start(destination, total)
            elif line.startswith(DONE_PREFIX):
                finished = Path(line[len(DONE_PREFIX):].strip())

        await run_ytdlp_streaming([
            "--format", FORMAT_SELECTOR,
            "--socket-timeout", "15",
            "--retries", "2",
            "--extractor-args", f"youtube:player_client={PLAYER_CLIENT}",
            *await js_runtime_args(),
            "--max-filesize", str(config.ARCHIVE_MAX_FILE_BYTES),
            "--no-part",
            "--no-simulate",
            # filepath is not populated this early; filename is.
            "--print", f"before_dl:{DEST_PREFIX}%(filename)s",
            "--print", f"before_dl:{SIZE_PREFIX}%(filesize,filesize_approx)s",
            "--print", f"after_move:{DONE_PREFIX}%(filepath)s",
            "--output", str(work_dir / "%(id)s.%(ext)s"),
            youtube_url,
        ], handle, timeout=config.ARCHIVE_DOWNLOAD_TIMEOUT_SECONDS)

        # No completion line means the download was skipped, which
        # --max-filesize does without failing.
        if finished is None:
            return None

        if finished.parent != work_dir or not finished.is_file():
            print(f"[YTDLP] Unexpected download path for {entry.id}: {finished}")
            return None

        return finished

    @staticmethod
    def _is_environmental(error: Exception) -> bool:
        """
        Whether a failure is about the extractor or the network rather than the
        video itself. A private or deleted video is a stable answer worth
        caching; a dead proxy is not.
        """
        if isinstance(error, (YtdlpMissing, YtdlpTimeout)):
            return True

        if isinstance(error, YtdlpError):
            # No exit code means yt-dlp never ran or never produced usable output.
            if error.returncode is None:
                return True
            details = error.failure_details
        else:
            details = str(error)

        return any(marker in details.lower() for marker in RETRYABLE_ERROR_MARKERS)

    @classmethod
    def _should_retry(cls, error: Exception) -> bool:
        # A missing binary will not appear part way through the loop.
        if isinstance(error, YtdlpMissing):
            return False
        return cls._is_environmental(error)

    async def _get_raw_video_url(self, youtube_url: str, max_retries: int = 3, base_delay: float = 1.0) -> ExtractionOutcome:
        """
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
                    *await js_runtime_args(),
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

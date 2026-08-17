import asyncio
from typing import Optional

import aiohttp

from core.search import ProviderHealth, VideoURLResult
from config import config

# A tunnel URL is served by the cobalt instance itself and carries a
# short-lived signed token, so it is cached for far less time than a CDN URL.
TUNNEL_CACHE_TTL_SECONDS = 10 * 60
REDIRECT_CACHE_TTL_SECONDS = 4 * 3600

# Codes naming the content are a verdict on the video and will say the same
# thing next time. Everything else (auth, rate limits, session tokens, fetch
# failures) is about the instance or the network.
CONTENT_ERROR_MARKER = "content"


class CobaltResult(VideoURLResult):
    """A VideoURLResult that also says whether the failure was ours to fix."""

    environmental_failure: bool = False


class CobaltClient:
    """
    Resolver backed by a self-hosted cobalt instance.

    Cobalt takes a URL and returns media, with no search of its own, so it can
    only ever stand behind a provider that already found the video.
    """

    def __init__(
        self,
        api_url: str = "",
        api_key: str = "",
        timeout: float = 30.0,
        video_quality: str = "1080",
    ):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.video_quality = video_quality
        self.health = ProviderHealth(available=bool(api_url))
        self._session: Optional[aiohttp.ClientSession] = None
        self._lock = asyncio.Lock()

    @property
    def enabled(self) -> bool:
        return bool(self.api_url)

    async def _get_session(self) -> aiohttp.ClientSession:
        async with self._lock:
            if self._session is None or self._session.closed:
                # trust_env stays off so a proxy meant for reaching YouTube is
                # not used to reach our own instance.
                self._session = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                    trust_env=False,
                )
            return self._session

    def _headers(self) -> dict:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Api-Key {self.api_key}"
        return headers

    async def resolve(self, url: str) -> CobaltResult:
        if not self.enabled:
            return CobaltResult(video_url=None, cacheable=False, environmental_failure=True)

        payload = {
            "url": url,
            "videoQuality": self.video_quality,
            "downloadMode": "auto",
            "youtubeVideoCodec": "h264",
            "youtubeVideoContainer": "mp4",
            # Anything cobalt cannot serve whole is tunnelled rather than handed
            # back as a job for a client that, here, is a plain <video> tag.
            "localProcessing": "disabled",
            "disableMetadata": True,
        }

        try:
            session = await self._get_session()
            async with session.post(self.api_url, json=payload, headers=self._headers()) as response:
                if response.status >= 500:
                    return self._fail(f"cobalt returned {response.status}")
                body = await response.json(content_type=None)
        except asyncio.TimeoutError:
            return self._fail(f"cobalt timed out after {self.timeout:g}s")
        except aiohttp.ClientError as e:
            return self._fail(f"cobalt request failed: {e}")
        except ValueError as e:
            return self._fail(f"cobalt returned invalid JSON: {e}")

        return self._interpret(body)

    def _interpret(self, body: dict) -> CobaltResult:
        if not isinstance(body, dict):
            return self._fail("cobalt returned a non-object body")

        status = body.get("status")

        if status == "redirect":
            return self._ok(body.get("url"), REDIRECT_CACHE_TTL_SECONDS)

        if status == "tunnel":
            return self._ok(body.get("url"), TUNNEL_CACHE_TTL_SECONDS)

        if status == "error":
            error = body.get("error") or {}
            code = str(error.get("code") or "unknown")
            if CONTENT_ERROR_MARKER in code:
                self.health.record_ok()
                return CobaltResult(video_url=None, cache_ttl_seconds=30 * 60, cacheable=True)
            return self._fail(f"cobalt error {code}")

        # picker means several media rather than one video, and local-processing
        # asks the caller to remux. Neither is something a <video> can play.
        return self._fail(f"cobalt returned unusable status {status!r}")

    def _ok(self, url: Optional[str], ttl: int) -> CobaltResult:
        if not url:
            return self._fail("cobalt returned a result with no URL")
        self.health.record_ok()
        return CobaltResult(video_url=url, cache_ttl_seconds=ttl, cacheable=True)

    def _fail(self, detail: str) -> CobaltResult:
        self.health.record_failure(detail)
        print(f"[COBALT] {detail}")
        return CobaltResult(video_url=None, cacheable=False, environmental_failure=True)

    def snapshot(self) -> dict:
        return {"enabled": self.enabled, **self.health.snapshot()}

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None


def client_from_config() -> CobaltClient:
    return CobaltClient(
        api_url=config.COBALT_API_URL,
        api_key=config.COBALT_API_KEY,
        timeout=config.COBALT_TIMEOUT_SECONDS,
        video_quality=config.COBALT_VIDEO_QUALITY,
    )

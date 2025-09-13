import time
import random
from typing import Optional, Union
from pytubefix import YouTube, Search
from core.search import KaraokeSourceProvider, KaraokeSearchResult, KaraokeEntry, VideoURLResult
from config import config
from urllib.parse import urlparse, urlunparse

class YTKaraokeSourceProvider(KaraokeSourceProvider):
    def __init__(self, allowed_channels: list[str] = None, karaoke_keywords: list[str] = None):
        super().__init__()
        # Examples: ["KaraFun", "Sing King", "Lucky Voice", "Karaoke Mugen"]
        self.allowed_channels = allowed_channels or []
        self.karaoke_keywords = karaoke_keywords or ["karaoke", "instrumental", "backing track", "sing along"]
    
    @property
    def provider_id(self) -> str:
        return "youtube"


    def _get_proxy_config(self) -> Optional[dict]:
        """Get proxy configuration for pytubefix."""
        if not config.PROXY_SERVER:
            return None

        # pytubefix expects proxies in requests format
        proxies = {
            "http": config.PROXY_SERVER,
            "https": config.PROXY_SERVER
        }

        # If proxy has authentication, format it as username:password@server
        if config.PROXY_USERNAME and config.PROXY_PASSWORD:
            parsed = urlparse(config.PROXY_SERVER)
            # Reconstruct URL with authentication
            netloc = f"{config.PROXY_USERNAME}:{config.PROXY_PASSWORD}@{parsed.hostname}:{parsed.port}"
            auth_server = urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
            proxies = {
                "http": auth_server,
                "https": auth_server
            }

        return proxies

    async def search(self, query: str) -> KaraokeSearchResult:
        try:
            enhanced_query = self._enhance_query_with_keywords(query)
            proxy_config = self._get_proxy_config()
            search = Search(enhanced_query, proxies=proxy_config)
            entries = []
            for video in search.videos:
                if self.allowed_channels and not self._is_allowed_channel(video.author):
                    continue

                entries.append(KaraokeEntry(
                    id=video.video_id,
                    title=video.title,
                    artist=video.author,
                    video_url=None,  # Will be loaded on demand
                    source=self.provider_id,
                    uploader=video.author,
                    duration=video.length
                ))

            return KaraokeSearchResult(entries=entries)

        except Exception as e:
            print(f"Search failed: {e}")
            return KaraokeSearchResult(entries=[])


    def _enhance_query_with_keywords(self, query: str) -> str:
        if not self.karaoke_keywords:
            return query
        keywords_str = " OR ".join(self.karaoke_keywords)
        return f"{query} ({keywords_str})"

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
        video_url = await self._get_raw_video_url(youtube_url)

        if video_url:
            return VideoURLResult(
                video_url=video_url,
                cache_ttl_seconds=4 * 3600,  # 4 hours - YouTube URLs are stable
                cacheable=True
            )
        else:
            return VideoURLResult(
                video_url=None,
                cache_ttl_seconds=30 * 60,  # 30 minutes for failures
                cacheable=True
            )

    async def _get_raw_video_url(self, youtube_url: str, max_retries: int = 3, base_delay: float = 1.0) -> Optional[str]:
        """
        Extract raw video URL using pytube2.
        Returns the highest quality video stream URL.
        """
        last_exception = None

        for attempt in range(max_retries + 1):
            try:
                proxy_config = self._get_proxy_config()
                if attempt == 0:
                    print(f"Using proxy config: {proxy_config}")

                yt = YouTube(youtube_url, proxies=proxy_config)
                stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
                if not stream:
                    stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_video=False).order_by('resolution').desc().first()
                if not stream:
                    stream = yt.streams.first()

                return stream.url if stream else None
            except Exception as e:
                last_exception = e
                error_message = str(e).lower()

                # Check if this is a retryable error
                is_proxy_auth_error = "407" in error_message or "proxy authentication required" in error_message
                is_tunnel_error = "tunnel connection failed" in error_message
                is_4xx_error = any(code in error_message for code in ["400", "401", "403", "404", "408", "429"])
                is_connection_error = "connection" in error_message or "timeout" in error_message
                should_retry = is_proxy_auth_error or is_tunnel_error or is_4xx_error or is_connection_error

                if attempt < max_retries and should_retry:
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    print(f"Attempt {attempt + 1} failed for {youtube_url}: {e}")
                    print(f"Retrying in {delay:.1f} seconds...")
                    time.sleep(delay)
                    continue
                else:
                    print(f"Failed to extract video URL for {youtube_url} after {attempt + 1} attempts")
                    print(f"Final error: {e}")
                    return None

        print(f"Unexpected retry loop exit for {youtube_url}. Last error: {last_exception}")
        return None

    async def close(self):
        # No cleanup needed for pytubefix
        pass

import time
import random
from typing import Optional, Union
import yt_dlp
from core.search import KaraokeSourceProvider, KaraokeSearchResult, KaraokeEntry, VideoURLResult
from config import config
from urllib.parse import urlparse, urlunparse
from concurrent.futures import ThreadPoolExecutor
import asyncio

class YTKaraokeSourceProvider(KaraokeSourceProvider):
    def __init__(self, allowed_channels: list[str] = None, karaoke_keywords: list[str] = None):
        super().__init__()
        # Examples: ["KaraFun", "Sing King", "Lucky Voice", "Karaoke Mugen"]
        self.allowed_channels = allowed_channels or []
        self.karaoke_keywords = karaoke_keywords or ["karaoke", "instrumental", "backing track", "sing along"]

    @property
    def provider_id(self) -> str:
        return "youtube"


    def _get_ydl_opts(self) -> dict:
        """Get yt-dlp options including proxy configuration."""
        opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'noplaylist': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['tv_simply']
                }
            }
        }

        # Configure proxy if available
        if config.PROXY_SERVER:
            parsed = urlparse(config.PROXY_SERVER)

            if config.PROXY_USERNAME and config.PROXY_PASSWORD:
                # Reconstruct URL with authentication
                netloc = f"{config.PROXY_USERNAME}:{config.PROXY_PASSWORD}@{parsed.hostname}:{parsed.port}"
                proxy_url = urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
            else:
                proxy_url = config.PROXY_SERVER

            opts['proxy'] = proxy_url

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

                    entries.append(KaraokeEntry(
                        id=video_info.get('id', ''),
                        title=video_info.get('title', 'Unknown Title'),
                        artist=uploader,
                        video_url=None,  # Will be loaded on demand
                        source=self.provider_id,
                        uploader=uploader,
                        duration=video_info.get('duration')
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
        Extract raw video URL using yt-dlp.
        Returns the best quality video stream URL.
        """
        last_exception = None

        for attempt in range(max_retries + 1):
            try:
                ydl_opts = self._get_ydl_opts()
                # Configure format selection for best quality mp4
                ydl_opts.update({
                    'format': 'best[ext=mp4]/best[ext=webm]/best',  # Prefer mp4, fallback to webm, then best available
                    'noplaylist': True,
                })

                loop = asyncio.get_event_loop()
                with ThreadPoolExecutor() as executor:
                    def extract_url():
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            info = ydl.extract_info(youtube_url, download=False)
                            return info.get('url') if info else None

                    video_url = await loop.run_in_executor(executor, extract_url)
                    return video_url

            except Exception as e:
                last_exception = e
                error_message = str(e).lower()

                # Check if this is a retryable error
                is_proxy_error = "proxy" in error_message or "407" in error_message
                is_connection_error = any(keyword in error_message for keyword in [
                    "connection", "timeout", "network", "dns"
                ])
                is_rate_limit = "429" in error_message or "rate limit" in error_message
                is_4xx_error = any(code in error_message for code in ["400", "401", "403", "404", "408"])

                should_retry = is_proxy_error or is_connection_error or is_rate_limit or is_4xx_error

                if attempt < max_retries and should_retry:
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    print(f"Attempt {attempt + 1} failed for {youtube_url}: {e}")
                    print(f"Retrying in {delay:.1f} seconds...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    print(f"Failed to extract video URL for {youtube_url} after {attempt + 1} attempts")
                    print(f"Final error: {e}")
                    return None

        print(f"Unexpected retry loop exit for {youtube_url}. Last error: {last_exception}")
        return None

    async def close(self):
        # No cleanup needed for yt-dlp
        pass

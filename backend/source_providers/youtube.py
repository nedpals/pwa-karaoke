import re
import time
import random
from urllib.parse import quote
from typing import Optional
from playwright.async_api import Browser
from pytubefix import YouTube
from core.search import KaraokeSourceProvider, KaraokeSearchResult, KaraokeEntry
from browser_manager import browser_manager
from config import config
from urllib.parse import urlparse, urlunparse

class YTKaraokeSourceProvider(KaraokeSourceProvider):
    def __init__(self, allowed_channels: list[str] = None, karaoke_keywords: list[str] = None):
        super().__init__()
        # Browser is now managed globally
        pass
        # Examples: ["KaraFun", "Sing King", "Lucky Voice", "Karaoke Mugen"]
        self.allowed_channels = allowed_channels or []
        self.karaoke_keywords = karaoke_keywords or ["karaoke", "instrumental", "backing track", "sing along"]
    
    @property
    def provider_id(self) -> str:
        return "youtube"

    async def _get_browser(self) -> Optional[Browser]:
        return await browser_manager.get_browser()

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
        browser = await self._get_browser()
        if not browser:
            return KaraokeSearchResult(entries=[])
        
        try:
            page_obj = await browser.new_page()
        except Exception:
            # Browser connection may have been closed, try to get a fresh browser
            browser = await browser_manager.get_browser()
            if not browser:
                return KaraokeSearchResult(entries=[])
            page_obj = await browser.new_page()

        try:
            enhanced_query = self._enhance_query_with_keywords(query)
            search_url = f"https://www.youtube.com/results?search_query={quote(enhanced_query)}"
            await page_obj.goto(search_url)

            await page_obj.wait_for_selector('ytd-video-renderer', timeout=10000)

            video_elements = await page_obj.query_selector_all('ytd-video-renderer')

            # First pass: collect all video metadata
            video_data = []
            for i, element in enumerate(video_elements):
                try:
                    title_element = await element.query_selector('#video-title')
                    title = await title_element.inner_text() if title_element else "Unknown Title"

                    channel_element = await element.query_selector('#text > a')
                    artist = await channel_element.inner_text() if channel_element else "Unknown Artist"

                    if self.allowed_channels and not self._is_allowed_channel(artist):
                        continue

                    link_element = await element.query_selector('#video-title')
                    href = await link_element.get_attribute('href') if link_element else ""
                    video_url = f"https://www.youtube.com{href}" if href else ""

                    if not video_url:
                        continue

                    duration_element = await element.query_selector('ytd-thumbnail-overlay-time-status-renderer span')
                    duration_text = await duration_element.inner_text() if duration_element else ""
                    duration = self._parse_duration(duration_text) if duration_text else None

                    video_id = self._extract_video_id(href) if href else f"unknown_{i}"

                    video_data.append({
                        'id': video_id,
                        'title': title.strip(),
                        'artist': artist.strip(),
                        'youtube_url': video_url,  # Keep YouTube URL for lazy loading
                        'duration': duration
                    })
                except Exception:
                    continue

            if not video_data:
                return KaraokeSearchResult(entries=[])

            # Create entries without fetching video URLs (lazy loading)
            entries = []
            for data in video_data:
                if data['id'] and data['id'] != 'unknown_':  # Skip entries without valid IDs
                    karaoke_entry = KaraokeEntry(
                        id=data['id'],
                        title=data['title'],
                        artist=data['artist'],
                        video_url=None,  # Will be loaded on demand
                        source=self.provider_id,
                        uploader=data['artist'],
                        duration=data['duration']
                    )
                    entries.append(karaoke_entry)

            return KaraokeSearchResult(entries=entries)

        finally:
            await page_obj.close()

    def _parse_duration(self, duration_text: str) -> int:
        if not duration_text:
            return None

        parts = duration_text.split(':')
        if len(parts) == 2:
            minutes, seconds = map(int, parts)
            return minutes * 60 + seconds
        elif len(parts) == 3:
            hours, minutes, seconds = map(int, parts)
            return hours * 3600 + minutes * 60 + seconds
        return None

    def _extract_video_id(self, href: str) -> str:
        if not href:
            return ""
        match = re.search(r'watch\?v=([^&]+)', href)
        return match.group(1) if match else ""

    def _enhance_query_with_keywords(self, query: str) -> str:
        if not self.karaoke_keywords:
            return query
        keywords_str = " OR ".join(self.karaoke_keywords)
        return f"{query} ({keywords_str})"

    def _is_allowed_channel(self, channel_name: str) -> bool:
        if not self.allowed_channels:
            return True
        return any(allowed.lower() in channel_name.lower() for allowed in self.allowed_channels)

    async def get_video_url(self, entry: KaraokeEntry) -> Optional[str]:
        """
        Fetch the actual video URL for a YouTube entry on demand.
        
        Args:
            entry: KaraokeEntry with YouTube video ID as the id
            
        Returns:
            The actual video URL or None if not available
        """
        if not entry.id:
            return None  # No video ID
            
        # Construct YouTube URL from video ID
        youtube_url = f"https://www.youtube.com/watch?v={entry.id}"
        return await self._get_raw_video_url(youtube_url)

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

                if proxy_config:
                    yt = YouTube(youtube_url, proxies=proxy_config)
                else:
                    yt = YouTube(youtube_url)

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
        # Browser cleanup is handled by browser_manager
        pass

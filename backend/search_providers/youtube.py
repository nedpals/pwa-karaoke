import re
import asyncio
from urllib.parse import quote
from playwright.async_api import async_playwright, Browser
from pytube import YouTube
from core.search import KaraokeSearchProvider, KaraokeSearchResult, KaraokeEntry

class YTKaraokeSearchProvider(KaraokeSearchProvider):
    def __init__(self, allowed_channels: list[str] = None, karaoke_keywords: list[str] = None):
        super().__init__()
        self.browser: Browser = None
        # Examples: ["KaraFun", "Sing King", "Lucky Voice", "Karaoke Mugen"]
        self.allowed_channels = allowed_channels or []
        self.karaoke_keywords = karaoke_keywords or ["karaoke", "instrumental", "backing track", "sing along"]

    async def _get_browser(self) -> Browser:
        if self.browser is None:
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(headless=True)
        return self.browser

    async def search(self, query: str) -> KaraokeSearchResult:
        browser = await self._get_browser()
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

                    video_id = self._extract_video_id(href) if href else str(i)

                    video_data.append({
                        'id': video_id,
                        'title': title.strip(),
                        'artist': artist.strip(),
                        'video_url': video_url,
                        'duration': duration
                    })
                except Exception:
                    continue

            if not video_data:
                return KaraokeSearchResult(entries=[])

            # Extract raw URLs in parallel
            video_urls = [data['video_url'] for data in video_data]
            raw_urls = await asyncio.gather(*[self._get_raw_video_url(url) for url in video_urls], return_exceptions=True)

            # Create entries only for successful extractions
            entries = []
            for data, raw_url in zip(video_data, raw_urls):
                # Skip if extraction failed or returned an exception
                if raw_url and not isinstance(raw_url, Exception):
                    karaoke_entry = KaraokeEntry(
                        id=hash(data['id']) % (10**9),
                        title=data['title'],
                        artist=data['artist'],
                        video_url=raw_url,
                        source="YouTube",
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

    async def _get_raw_video_url(self, youtube_url: str) -> str | None:
        """
        Extract raw video URL using pytube2.
        Returns the highest quality video stream URL.
        """
        try:
            yt = YouTube(youtube_url)
            # Get the highest quality progressive stream (video + audio)
            stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
            
            # If no progressive stream, get highest quality adaptive video stream
            if not stream:
                stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_video=False).order_by('resolution').desc().first()
            
            # If still no stream, get any available stream
            if not stream:
                stream = yt.streams.first()
                
            return stream.url if stream else None
        except Exception:
            # Return None if extraction fails, fallback to original URL
            return None

    async def close(self):
        if self.browser:
            await self.browser.close()
            self.browser = None

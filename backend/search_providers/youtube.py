import re
from urllib.parse import quote, urlparse, parse_qs
from playwright.async_api import async_playwright, Browser
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

            entries = []

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

                    duration_element = await element.query_selector('ytd-thumbnail-overlay-time-status-renderer span')
                    duration_text = await duration_element.inner_text() if duration_element else ""
                    duration = self._parse_duration(duration_text) if duration_text else None

                    video_id = self._extract_video_id(href) if href else str(i)
                    embed_url = self._get_youtube_embed_url(video_url) if video_url else None

                    karaoke_entry = KaraokeEntry(
                        id=hash(video_id) % (10**9),
                        title=title.strip(),
                        artist=artist.strip(),
                        video_url=video_url,
                        source="YouTube",
                        uploader=artist.strip(),
                        duration=duration,
                        embed_url=embed_url
                    )
                    entries.append(karaoke_entry)
                except Exception as e:
                    continue

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

    def _get_youtube_embed_url(self, url: str) -> str | None:
        """
        Convert YouTube URL to embed URL for iframe usage.
        Supports various YouTube URL formats and returns optimized embed URL.
        """
        try:
            video_id = ''
            
            parsed_url = urlparse(url)
            
            # Handle different YouTube URL formats
            if parsed_url.hostname == 'youtu.be':
                # Short URL format: https://youtu.be/VIDEO_ID
                video_id = parsed_url.path.lstrip('/')
            elif parsed_url.hostname and 'youtube.com' in parsed_url.hostname:
                # Handle various youtube.com formats
                if parsed_url.path == '/watch':
                    # Standard format: https://www.youtube.com/watch?v=VIDEO_ID
                    video_id = parse_qs(parsed_url.query).get('v', [''])[0]
                elif parsed_url.path.startswith('/embed/'):
                    # Embed format: https://www.youtube.com/embed/VIDEO_ID
                    video_id = parsed_url.path.replace('/embed/', '')
                elif parsed_url.path.startswith('/v/'):
                    # Alternative format: https://www.youtube.com/v/VIDEO_ID
                    video_id = parsed_url.path.replace('/v/', '')
            
            # Clean video ID (remove any extra parameters)
            video_id = video_id.split('&')[0].split('?')[0]
            
            if video_id:
                # Return optimized embed URL with performance settings
                return f"https://www.youtube.com/embed/{video_id}?autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0"
            
            return None
            
        except Exception:
            return None

    async def close(self):
        if self.browser:
            await self.browser.close()
            self.browser = None

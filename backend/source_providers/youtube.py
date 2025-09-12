import re
from urllib.parse import quote
from typing import Optional
from playwright.async_api import Browser
from pytubefix import YouTube
from core.search import KaraokeSourceProvider, KaraokeSearchResult, KaraokeEntry
from browser_manager import browser_manager
from services.po_token_service import po_token_service

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
            
            # Wait a bit more for YouTube to fully initialize and generate tokens
            await page_obj.wait_for_timeout(1000)
            
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
            else:
                first_video = video_data[0]
                video_id = first_video['id']
                if not video_id or video_id.startswith("unknown_"):
                    return KaraokeSearchResult(entries=[])
                embed_url = f"https://www.youtube.com/watch?v={video_id}"
                await page_obj.goto(embed_url, wait_until="domcontentloaded")
                await page_obj.wait_for_timeout(2000)
                await po_token_service.add_token_from_page(page_obj)

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

    async def _get_raw_video_url(self, youtube_url: str) -> Optional[str]:
        """
        Extract raw video URL using pytubefix with PO token authentication.
        Returns the highest quality video stream URL.
        """
        try:
            # Get PO token for enhanced access
            token_data = await po_token_service.get_po_token()
            print(f"Using PO token data: {token_data}")
            
            # Create YouTube object with PO token if available
            if token_data and token_data.get('poToken'):
                # Create a po_token_verifier function that returns the tokens
                def po_token_verifier():
                    return token_data['visitorData'], token_data['poToken']
                
                yt = YouTube(
                    youtube_url, 
                    use_po_token=True,
                    po_token_verifier=po_token_verifier
                )
            else:
                # Fall back to ANDROID client which doesn't require PO token
                yt = YouTube(youtube_url, 'ANDROID')
            
            # Get the highest quality progressive stream (video + audio)
            stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
            
            # If no progressive stream, get highest quality adaptive video stream
            if not stream:
                stream = yt.streams.filter(adaptive=True, file_extension='mp4', only_video=False).order_by('resolution').desc().first()
            
            # If still no stream, get any available stream
            if not stream:
                stream = yt.streams.first()
                
            return stream.url if stream else None
        except Exception as e:
            # Return None if extraction fails, fallback to original URL
            print(f"Failed to extract video URL for {youtube_url}")
            print(e)
            return None

    async def close(self):
        # Browser cleanup is handled by browser_manager
        pass

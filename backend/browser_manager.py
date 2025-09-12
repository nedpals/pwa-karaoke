"""
Browser manager for sharing Playwright browsers across the application.
"""
from typing import Optional
from playwright.async_api import async_playwright, Browser
from config import config


class BrowserManager:
    """Singleton browser manager to share browser instances."""
    
    _instance: Optional['BrowserManager'] = None
    _browser: Optional[Browser] = None
    _playwright = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def get_browser(self) -> Optional[Browser]:
        """Get shared browser instance."""
        if not config.PLAYWRIGHT_ENABLED:
            return None
            
        if self._browser is None or not self._browser.is_connected():
            await self._ensure_browser()
        
        return self._browser

    async def _ensure_browser(self):
        """Ensure we have a connected browser instance."""
        # Clean up stale browser if it exists
        if self._browser and not self._browser.is_connected():
            self._browser = None
            
        if self._browser is None:
            if self._playwright is None:
                self._playwright = await async_playwright().start()
            
            if config.PLAYWRIGHT_BROWSER_URL:
                # Connect to remote browser (e.g., browserless/chrome)
                # Note: Anti-detection args should be configured on browserless side
                self._browser = await self._playwright.chromium.connect_over_cdp(config.PLAYWRIGHT_BROWSER_URL)
            else:
                # Launch local browser with anti-detection settings
                self._browser = await self._playwright.chromium.launch(
                    headless=config.PLAYWRIGHT_HEADLESS,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--disable-dev-shm-usage",
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-web-security",
                        "--disable-features=VizDisplayCompositor"
                    ]
                )
    
    async def close(self):
        """Close browser and cleanup."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None


# Global instance
browser_manager = BrowserManager()
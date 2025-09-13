"""
Configuration settings for PWA Karaoke backend.
"""
import os


class Config:
    """Application configuration class."""
    
    # Playwright configuration
    PLAYWRIGHT_ENABLED: bool = os.getenv("PLAYWRIGHT_ENABLED", "true").lower() == "true"
    PLAYWRIGHT_HEADLESS: bool = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower() == "true"
    PLAYWRIGHT_BROWSER_URL: str = os.getenv("PLAYWRIGHT_BROWSER_URL", "")  # For remote browsers like browserless

    # Proxy configuration (used by both Playwright and pytubefix)
    PROXY_SERVER: str = os.getenv("PROXY_SERVER", "")  # Proxy server URL (e.g., "http://proxy:8080")
    PROXY_USERNAME: str = os.getenv("PROXY_USERNAME", "")  # Proxy authentication username
    PROXY_PASSWORD: str = os.getenv("PROXY_PASSWORD", "")  # Proxy authentication password


# Global configuration instance
config = Config()
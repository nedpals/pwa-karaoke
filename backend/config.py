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
    PLAYWRIGHT_PROXY_SERVER: str = os.getenv("PLAYWRIGHT_PROXY_SERVER", "")  # Proxy server URL (e.g., "http://proxy:8080")
    PLAYWRIGHT_PROXY_USERNAME: str = os.getenv("PLAYWRIGHT_PROXY_USERNAME", "")  # Proxy authentication username
    PLAYWRIGHT_PROXY_PASSWORD: str = os.getenv("PLAYWRIGHT_PROXY_PASSWORD", "")  # Proxy authentication password


# Global configuration instance
config = Config()
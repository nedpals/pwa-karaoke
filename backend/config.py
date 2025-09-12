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


# Global configuration instance
config = Config()
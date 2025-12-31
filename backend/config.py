"""
Configuration settings for PWA Karaoke backend.
"""
import os


class Config:
    """Application configuration class."""
    PROXY_SERVER: str = os.getenv("PROXY_SERVER", "")  # Proxy server URL (e.g., "http://proxy:8080")
    PROXY_USERNAME: str = os.getenv("PROXY_USERNAME", "")  # Proxy authentication username
    PROXY_PASSWORD: str = os.getenv("PROXY_PASSWORD", "")  # Proxy authentication password
    YTDLP_RUNTIME: str = os.getenv("YTDLP_RUNTIME", "bun")  # JavaScript runtime for yt-dlp ('node', 'bun', etc.)


# Global configuration instance
config = Config()
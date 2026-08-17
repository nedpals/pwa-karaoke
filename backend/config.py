"""
Configuration settings for PWA Karaoke backend.
"""
import os


def _list_env(name: str) -> list[str]:
    return [part.strip() for part in os.getenv(name, "").split(",") if part.strip()]


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, ""))
    except ValueError:
        return default


class Config:
    """Application configuration class."""
    PROXY_SERVER: str = os.getenv("PROXY_SERVER", "")  # Proxy server URL (e.g., "http://proxy:8080")
    PROXY_USERNAME: str = os.getenv("PROXY_USERNAME", "")  # Proxy authentication username
    PROXY_PASSWORD: str = os.getenv("PROXY_PASSWORD", "")  # Proxy authentication password
    YTDLP_RUNTIME: str = os.getenv("YTDLP_RUNTIME", "bun")  # JavaScript runtime for yt-dlp ('node', 'bun', etc.)
    YTDLP_BINARY: str = os.getenv("YTDLP_BINARY", "yt-dlp")  # yt-dlp executable name or path
    YTDLP_TIMEOUT_SECONDS: float = _float_env("YTDLP_TIMEOUT_SECONDS", 45.0)  # Hard limit per yt-dlp invocation
    YTDLP_EXTRA_ARGS: str = os.getenv("YTDLP_EXTRA_ARGS", "")  # Extra CLI flags, shell quoted
    SEARCH_TIMEOUT_SECONDS: float = _float_env("SEARCH_TIMEOUT_SECONDS", 20.0)  # Hard limit per search
    KARAOKE_SOURCES: list[str] = _list_env("KARAOKE_SOURCES")  # Provider IDs to enable; empty enables all
    COBALT_API_URL: str = os.getenv("COBALT_API_URL", "")  # Self-hosted cobalt instance; empty disables the fallback
    COBALT_API_KEY: str = os.getenv("COBALT_API_KEY", "")  # Sent as "Authorization: Api-Key ..." when set
    COBALT_TIMEOUT_SECONDS: float = _float_env("COBALT_TIMEOUT_SECONDS", 30.0)  # Hard limit per cobalt request
    COBALT_VIDEO_QUALITY: str = os.getenv("COBALT_VIDEO_QUALITY", "720")  # max/2160/1440/1080/720/480/360/240/144


# Global configuration instance
config = Config()

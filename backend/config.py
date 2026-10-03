"""
Configuration settings for PWA Karaoke backend.
"""
import os


def _list_env(name: str) -> list[str]:
    return [part.strip() for part in os.getenv(name, "").split(",") if part.strip()]


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name, "").strip().lower()
    if not value:
        return default
    return value not in ("0", "false", "no", "off")


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
    YTDLP_RUNTIME: str = os.getenv("YTDLP_RUNTIME", "deno")  # JavaScript runtime for yt-dlp, as RUNTIME[:PATH] ('deno', 'node', ...)
    YTDLP_PLAYER_CLIENT: str = os.getenv("YTDLP_PLAYER_CLIENT", "")  # YouTube player clients, comma separated; empty uses yt-dlp's defaults
    YTDLP_BINARY: str = os.getenv("YTDLP_BINARY", "yt-dlp")  # yt-dlp executable name or path
    YTDLP_TIMEOUT_SECONDS: float = _float_env("YTDLP_TIMEOUT_SECONDS", 45.0)  # Hard limit per yt-dlp invocation
    YTDLP_EXTRA_ARGS: str = os.getenv("YTDLP_EXTRA_ARGS", "")  # Extra CLI flags, shell quoted
    SEARCH_TIMEOUT_SECONDS: float = _float_env("SEARCH_TIMEOUT_SECONDS", 20.0)  # Hard limit per search
    KARAOKE_SOURCES: list[str] = _list_env("KARAOKE_SOURCES")  # Provider IDs to enable; empty enables all
    EMBED_PLAYBACK: bool = _bool_env("EMBED_PLAYBACK", True)  # Play through a source's embed player before its stream


# Global configuration instance
config = Config()

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


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, ""))
    except ValueError:
        return default


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


class Config:
    """Application configuration class."""
    PROXY_SERVER: str = os.getenv("PROXY_SERVER", "")  # Proxy server URL (e.g., "http://proxy:8080")
    PROXY_USERNAME: str = os.getenv("PROXY_USERNAME", "")  # Proxy authentication username
    PROXY_PASSWORD: str = os.getenv("PROXY_PASSWORD", "")  # Proxy authentication password
    YTDLP_RUNTIME: str = os.getenv("YTDLP_RUNTIME", "bun")  # JS runtime yt-dlp may use; empty disables the flag
    YTDLP_PLAYER_CLIENT: str = os.getenv("YTDLP_PLAYER_CLIENT", "android")  # Decides which formats come back; see the provider
    YTDLP_BINARY: str = os.getenv("YTDLP_BINARY", "yt-dlp")  # yt-dlp executable name or path
    YTDLP_TIMEOUT_SECONDS: float = _float_env("YTDLP_TIMEOUT_SECONDS", 45.0)  # Hard limit per yt-dlp invocation
    YTDLP_EXTRA_ARGS: str = os.getenv("YTDLP_EXTRA_ARGS", "")  # Extra CLI flags, shell quoted
    SEARCH_TIMEOUT_SECONDS: float = _float_env("SEARCH_TIMEOUT_SECONDS", 20.0)  # Hard limit per search
    KARAOKE_SOURCES: list[str] = _list_env("KARAOKE_SOURCES")  # Provider IDs to enable; empty enables all

    # Media archive. Off by default: it keeps durable copies of what plays,
    # which is a decision for whoever runs the server rather than a default.
    ARCHIVE_ENABLED: bool = _bool_env("ARCHIVE_ENABLED", False)
    ARCHIVE_DIR: str = os.getenv("ARCHIVE_DIR", "media_archive")  # Where copies live; mount a volume here
    ARCHIVE_MAX_BYTES: int = _int_env("ARCHIVE_MAX_BYTES", 20 * 1024 ** 3)  # Cap on the whole archive
    ARCHIVE_MAX_FILE_BYTES: int = _int_env("ARCHIVE_MAX_FILE_BYTES", 300 * 1024 ** 2)  # Refuse anything larger
    ARCHIVE_URL_TTL_SECONDS: int = _int_env("ARCHIVE_URL_TTL_SECONDS", 6 * 3600)  # Lifetime of a signed media URL
    ARCHIVE_URL_SECRET: str = os.getenv("ARCHIVE_URL_SECRET", "")  # Signing key; random per process when unset
    ARCHIVE_DOWNLOAD_TIMEOUT_SECONDS: float = _float_env("ARCHIVE_DOWNLOAD_TIMEOUT_SECONDS", 600.0)
    ARCHIVE_MAX_CONCURRENT_DOWNLOADS: int = _int_env("ARCHIVE_MAX_CONCURRENT_DOWNLOADS", 2)
    ARCHIVE_RETRY_AFTER_SECONDS: float = _float_env("ARCHIVE_RETRY_AFTER_SECONDS", 1800.0)  # Quiet period after a failed download


# Global configuration instance
config = Config()

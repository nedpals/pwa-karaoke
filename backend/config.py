"""
Configuration settings for PWA Karaoke backend.
"""
import os


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
    # Resolve the CDN redirect server side and hand clients the final URL.
    YTDLP_FOLLOW_REDIRECTS: bool = os.getenv("YTDLP_FOLLOW_REDIRECTS", "1") not in ("0", "false", "False")
    YTDLP_REDIRECT_TIMEOUT: float = _float_env("YTDLP_REDIRECT_TIMEOUT", 10.0)


# Global configuration instance
config = Config()

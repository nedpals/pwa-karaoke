#!/bin/sh
set -e

if [ "${YTDLP_AUTO_UPDATE:-0}" = "1" ]; then
    echo "[STARTUP] Refreshing yt-dlp..."
    if ! uv pip install --no-cache --python /app/.venv/bin/python --upgrade "yt-dlp[default,deno]"; then
        echo "[STARTUP] yt-dlp refresh failed, continuing with the image version"
    fi
fi

exec "$@"

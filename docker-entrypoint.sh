#!/bin/sh
set -e

if [ "${YTDLP_AUTO_UPDATE:-0}" = "1" ]; then
    echo "[STARTUP] Refreshing yt-dlp..."
    if ! pip install --no-cache-dir --upgrade "yt-dlp[default,deno]"; then
        echo "[STARTUP] yt-dlp refresh failed, continuing with the image version"
    fi
fi

exec "$@"

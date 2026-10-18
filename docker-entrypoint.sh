#!/bin/sh
set -e

if [ "${YTDLP_AUTO_UPDATE:-0}" = "1" ]; then
    echo "[STARTUP] Refreshing yt-dlp (${YTDLP_CHANNEL:-stable})..."
    if ! install-ytdlp.sh; then
        echo "[STARTUP] yt-dlp refresh failed, continuing with the image version"
    fi
fi

exec "$@"

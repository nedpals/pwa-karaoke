#!/bin/sh
# Installs yt-dlp into the app's venv. Pass an exact version to pin one;
# otherwise YTDLP_CHANNEL picks the newest stable release or nightly build.
set -e

version="${1:-latest}"
channel="${YTDLP_CHANNEL:-stable}"

if [ "$version" != "latest" ]; then
    set -- "yt-dlp[default,deno]==$version"
elif [ "$channel" = "nightly" ]; then
    # Nightlies are published as pre-releases. The pre-release bound opts
    # yt-dlp into them without letting its dependencies follow.
    set -- --upgrade "yt-dlp[default,deno]>=0.0.0.dev0"
elif [ "$channel" = "stable" ]; then
    # A plain upgrade keeps an installed nightly, so reinstall to move back.
    set -- --upgrade --reinstall-package yt-dlp "yt-dlp[default,deno]"
else
    echo "Unknown YTDLP_CHANNEL '$channel', expected stable or nightly" >&2
    exit 1
fi

uv pip install --no-cache --python /app/.venv/bin/python "$@"

"""
Durable copies of the videos that have already played.

A resolved source URL is signed, short lived and only as good as the extractor
that produced it, so a song that played last week can be unplayable tonight
because the source started refusing the server. A copy on disk has none of those
properties: once a song is in the archive it plays without the source being
involved at all.

The archive is addressed by (source, entry id) and hands out signed URLs, which
keeps it from doubling as an open media host for anyone who can guess a video
ID. Only a local disk backend exists today; MediaArchive is the interface an
S3 compatible one would implement.
"""

import asyncio
import hashlib
import hmac
import os
import secrets
import shutil
import string
import tempfile
import time
from pathlib import Path
from typing import Awaitable, Callable, NamedTuple, Optional
from urllib.parse import quote

from config import config

# Where archived media is served from. Shared with the route in main.py so the
# two cannot drift apart.
MEDIA_URL_PREFIX = "/media"

CONTENT_TYPES = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
}

# Tried in order when looking for a copy, since the key carries no extension.
MEDIA_EXTENSIONS = tuple(CONTENT_TYPES)

# A key is also a path, so the alphabet is a whitelist rather than an escape.
KEY_ALPHABET = frozenset(string.ascii_letters + string.digits + "-_")
MAX_KEY_PART = 64

INCOMING_DIRNAME = ".incoming"

# Long enough that a download in progress is not mistaken for abandoned work.
STALE_INCOMING_SECONDS = 24 * 3600


class ArchivedMedia(NamedTuple):
    key: str  # Carries the extension, unlike the key passed to locate()
    path: Path
    size_bytes: int
    content_type: str


def archive_key(source: str, entry_id: str) -> Optional[str]:
    """
    The archive key for an entry, or None when it cannot be trusted as one.

    Both halves arrive from the client on /get_video_url, so anything outside
    the alphabet is refused outright rather than sanitised into something that
    still resolves.
    """
    parts = []
    for part in (source, entry_id):
        if not part or len(part) > MAX_KEY_PART or not KEY_ALPHABET.issuperset(part):
            return None
        parts.append(part)

    return "/".join(parts)


class MediaArchive:
    """
    No archive at all. Every call is the answer a miss would give, so callers
    need no branch of their own for the feature being off.
    """

    enabled: bool = False
    staging_dir: Optional[Path] = None

    async def locate(self, key: str) -> Optional[ArchivedMedia]:
        return None

    def url_for(self, media: ArchivedMedia) -> str:
        raise NotImplementedError

    def verify(self, key: str, expires: int, signature: str) -> Optional[Path]:
        """The file a signed request is asking for, or None if it may not have it."""
        return None

    async def store(self, key: str, source_path: Path) -> Optional[ArchivedMedia]:
        return None

    async def discard(self, key: str):
        pass

    def stats(self) -> dict:
        return {"enabled": False}


class LocalDiskArchive(MediaArchive):
    """
    Copies under a directory on the server, served by this app.

    Suits the single container deployment, where a mounted volume is all the
    durability there is to have. Point ARCHIVE_DIR at a volume, or the archive
    is thrown away with the container it was built in.
    """

    enabled = True

    def __init__(
        self,
        root: Path,
        max_bytes: int,
        url_ttl_seconds: int,
        secret: str,
    ):
        self.root = Path(root).resolve()
        self.max_bytes = max_bytes
        self.url_ttl_seconds = url_ttl_seconds
        self._secret = secret.encode()

        self.staging_dir = self.root / INCOMING_DIRNAME
        self.staging_dir.mkdir(parents=True, exist_ok=True)
        self._sweep_staging()

    def _sweep_staging(self):
        """Drop work directories left behind by a run that was killed mid download."""
        cutoff = time.time() - STALE_INCOMING_SECONDS
        for leftover in self.staging_dir.iterdir():
            try:
                if leftover.stat().st_mtime > cutoff:
                    continue
                if leftover.is_dir():
                    shutil.rmtree(leftover, ignore_errors=True)
                else:
                    leftover.unlink()
            except OSError as e:
                print(f"[ARCHIVE] Could not clear {leftover}: {e}")

    def _path_for(self, relative_key: str) -> Optional[Path]:
        """Resolve a key to a path under the archive root, or None if it escapes."""
        candidate = (self.root / relative_key).resolve()
        if self.root not in candidate.parents:
            return None
        return candidate

    async def locate(self, key: str) -> Optional[ArchivedMedia]:
        return await asyncio.to_thread(self._locate, key)

    def _locate(self, key: str) -> Optional[ArchivedMedia]:
        for extension in MEDIA_EXTENSIONS:
            path = self._path_for(key + extension)
            if path is None or not path.is_file():
                continue

            # mtime doubles as the last used stamp, which is what eviction reads.
            try:
                os.utime(path, None)
            except OSError:
                pass

            return ArchivedMedia(
                key=key + extension,
                path=path,
                size_bytes=path.stat().st_size,
                content_type=CONTENT_TYPES[extension],
            )

        return None

    def _sign(self, key: str, expires: int) -> str:
        payload = f"{key}|{expires}".encode()
        return hmac.new(self._secret, payload, hashlib.sha256).hexdigest()

    def url_for(self, media: ArchivedMedia) -> str:
        expires = int(time.time()) + self.url_ttl_seconds
        signature = self._sign(media.key, expires)
        return f"{MEDIA_URL_PREFIX}/{quote(media.key)}?expires={expires}&signature={signature}"

    def verify(self, key: str, expires: int, signature: str) -> Optional[Path]:
        if expires < time.time():
            return None

        if not hmac.compare_digest(self._sign(key, expires), signature or ""):
            return None

        # The signature already establishes that we minted this key, but the
        # containment check stays: it is the part that does not depend on the
        # secret having stayed secret.
        path = self._path_for(key)
        return path if path is not None and path.is_file() else None

    async def store(self, key: str, source_path: Path) -> Optional[ArchivedMedia]:
        return await asyncio.to_thread(self._store, key, source_path)

    def _store(self, key: str, source_path: Path) -> Optional[ArchivedMedia]:
        extension = source_path.suffix.lower()
        if extension not in CONTENT_TYPES:
            print(f"[ARCHIVE] Refusing {source_path.name} for {key}: unsupported container")
            return None

        size_bytes = source_path.stat().st_size
        if size_bytes > config.ARCHIVE_MAX_FILE_BYTES:
            print(f"[ARCHIVE] Refusing {key}: {size_bytes} bytes is over the per file cap")
            return None

        destination = self._path_for(key + extension)
        if destination is None:
            return None

        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            # Staging lives under the root, so this is a rename rather than a
            # copy and no half written file is ever visible under the real key.
            os.replace(source_path, destination)
        except OSError:
            shutil.move(str(source_path), str(destination))

        self._evict_over_cap()

        return ArchivedMedia(
            key=key + extension,
            path=destination,
            size_bytes=size_bytes,
            content_type=CONTENT_TYPES[extension],
        )

    def _stored_files(self) -> list[Path]:
        return [
            path for path in self.root.rglob("*")
            if path.is_file() and self.staging_dir not in path.parents
        ]

    def _evict_over_cap(self):
        """
        Drop least recently played copies until the archive fits again.

        A copy that is playing right now is evictable like any other. It is the
        least recently used one, so it takes a near full archive and a long
        song to happen, and the player re-resolves when a stream dies.
        """
        files = self._stored_files()
        total = sum(path.stat().st_size for path in files)
        if total <= self.max_bytes:
            return

        for path in sorted(files, key=lambda p: p.stat().st_mtime):
            if total <= self.max_bytes:
                break
            try:
                size = path.stat().st_size
                path.unlink()
                total -= size
                print(f"[ARCHIVE] Evicted {path.relative_to(self.root)} to stay under the cap")
            except OSError as e:
                print(f"[ARCHIVE] Could not evict {path}: {e}")

    async def discard(self, key: str):
        await asyncio.to_thread(self._discard, key)

    def _discard(self, key: str):
        for extension in MEDIA_EXTENSIONS:
            path = self._path_for(key + extension)
            if path is None or not path.is_file():
                continue
            try:
                path.unlink()
                print(f"[ARCHIVE] Dropped {key}{extension}")
            except OSError as e:
                print(f"[ARCHIVE] Could not drop {path}: {e}")

    def stats(self) -> dict:
        try:
            files = self._stored_files()
            return {
                "enabled": True,
                "backend": "local_disk",
                "path": str(self.root),
                "files": len(files),
                "bytes": sum(path.stat().st_size for path in files),
                "max_bytes": self.max_bytes,
            }
        except OSError as e:
            return {"enabled": True, "backend": "local_disk", "error": str(e)}


# Given a working directory, produces the downloaded file, or None when the
# source cannot supply one.
Downloader = Callable[[Path], Awaitable[Optional[Path]]]


class MediaArchiver:
    """
    Fills an archive in the background.

    Nothing here is on the playback path: a song plays from its source URL the
    first time and from the archive every time after. One download per key at
    once, and a small ceiling on how many run together, because the box serving
    the room is the same one doing the fetching.
    """

    def __init__(self, archive: MediaArchive, max_concurrent: int, retry_after: float):
        self.archive = archive
        self.retry_after = retry_after
        self._semaphore = asyncio.Semaphore(max(1, max_concurrent))
        self._in_flight: dict[str, asyncio.Task] = {}
        self._failed_until: dict[str, float] = {}

    def schedule(self, key: str, download: Downloader):
        """
        Queue a download unless one is already running for this key or the last
        attempt failed recently. Scheduling happens on every resolution of an
        unarchived song, which for a song sitting in a queue is often, so a key
        that cannot be downloaded has to stop asking rather than retry per
        broadcast.
        """
        if not self.archive.enabled or key in self._in_flight:
            return

        now = time.time()
        if self._failed_until.get(key, 0.0) > now:
            return

        self._forget_expired_failures(now)

        task = asyncio.create_task(self._archive(key, download))
        self._in_flight[key] = task
        task.add_done_callback(lambda _: self._in_flight.pop(key, None))

    def _forget_expired_failures(self, now: float):
        for key in [k for k, until in self._failed_until.items() if until <= now]:
            self._failed_until.pop(key, None)

    async def _archive(self, key: str, download: Downloader):
        async with self._semaphore:
            work_dir = Path(tempfile.mkdtemp(dir=self.archive.staging_dir))
            try:
                print(f"[ARCHIVE] Downloading {key}")
                downloaded = await download(work_dir)
                if downloaded is None:
                    # Skipped or refused rather than broken, but either way
                    # asking again straight away would get the same answer.
                    self._failed_until[key] = time.time() + self.retry_after
                    print(f"[ARCHIVE] Nothing to store for {key}")
                    return

                media = await self.archive.store(key, downloaded)
                if media is not None:
                    print(f"[ARCHIVE] Stored {media.key} ({media.size_bytes} bytes)")
                else:
                    self._failed_until[key] = time.time() + self.retry_after

            except asyncio.CancelledError:
                raise
            except Exception as e:
                self._failed_until[key] = time.time() + self.retry_after
                print(f"[ARCHIVE] Failed to archive {key}: {e}")
            finally:
                shutil.rmtree(work_dir, ignore_errors=True)

    async def close(self, timeout: float = 5.0):
        """Give downloads in flight a moment to land, then drop them."""
        tasks = list(self._in_flight.values())
        if not tasks:
            return

        print(f"[ARCHIVE] Waiting on {len(tasks)} download(s)")
        done, pending = await asyncio.wait(tasks, timeout=timeout)
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)


_archive: MediaArchive = MediaArchive()
_archiver: Optional[MediaArchiver] = None


def build_media_archive() -> MediaArchive:
    if not config.ARCHIVE_ENABLED:
        return MediaArchive()

    # A generated secret is fine: URLs are minted per request and the player
    # re-resolves when one stops working. Set ARCHIVE_URL_SECRET to keep URLs
    # valid across a restart.
    secret = config.ARCHIVE_URL_SECRET or secrets.token_urlsafe(32)

    return LocalDiskArchive(
        root=Path(config.ARCHIVE_DIR),
        max_bytes=config.ARCHIVE_MAX_BYTES,
        url_ttl_seconds=config.ARCHIVE_URL_TTL_SECONDS,
        secret=secret,
    )


def init_media_archive() -> MediaArchive:
    """Called once from the FastAPI lifespan, before anything resolves a URL."""
    global _archive, _archiver

    _archive = build_media_archive()
    _archiver = MediaArchiver(
        _archive,
        config.ARCHIVE_MAX_CONCURRENT_DOWNLOADS,
        config.ARCHIVE_RETRY_AFTER_SECONDS,
    )
    return _archive


async def close_media_archive():
    global _archive, _archiver

    if _archiver is not None:
        await _archiver.close()

    _archive = MediaArchive()
    _archiver = None


def get_media_archive() -> MediaArchive:
    return _archive


def get_media_archiver() -> Optional[MediaArchiver]:
    return _archiver

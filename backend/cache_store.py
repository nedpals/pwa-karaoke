import sqlite3
import hashlib
import json
import time
from typing import Optional, Dict, Any
from pathlib import Path
import tempfile
import os

class CacheStore:
    """
    Temporary SQLite-based cache for storing video URLs and search results.
    Database is created in memory/temp and automatically cleaned up on server shutdown.
    """

    def __init__(self):
        self.temp_dir = tempfile.mkdtemp(prefix="karaoke_cache_")
        self.db_path = Path(self.temp_dir) / "cache.db"
        self.connection = sqlite3.connect(str(self.db_path), check_same_thread=False)

        # Enable WAL mode for better concurrent access
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA synchronous=NORMAL")

        self._init_tables()

        print(f"[CACHE] Initialized temporary cache database at {self.db_path}")

    def _init_tables(self):
        self.connection.executescript("""
            -- Video URL cache
            CREATE TABLE IF NOT EXISTS video_url_cache (
                entry_id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                video_url TEXT,
                created_at REAL NOT NULL,
                expires_at REAL
            );

            -- Search results cache
            CREATE TABLE IF NOT EXISTS search_cache (
                query_hash TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                results TEXT NOT NULL, -- JSON serialized results
                created_at REAL NOT NULL,
                expires_at REAL
            );

            -- Create indexes for performance
            CREATE INDEX IF NOT EXISTS idx_video_url_source ON video_url_cache(source);
            CREATE INDEX IF NOT EXISTS idx_video_url_expires ON video_url_cache(expires_at);
            CREATE INDEX IF NOT EXISTS idx_search_expires ON search_cache(expires_at);
        """)
        self.connection.commit()

    def cache_video_url(self, entry_id: str, source: str, video_url: Optional[str], ttl_seconds: int = 3600):
        now = time.time()
        expires_at = now + ttl_seconds

        try:
            self.connection.execute("""
                INSERT OR REPLACE INTO video_url_cache
                (entry_id, source, video_url, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
            """, (entry_id, source, video_url, now, expires_at))
            self.connection.commit()

            cache_status = "HIT" if video_url else "MISS"
            print(f"[CACHE] Stored video URL {cache_status} for {entry_id} (expires in {ttl_seconds}s)")

        except sqlite3.Error as e:
            print(f"[CACHE] Error storing video URL for {entry_id}: {e}")

    def get_video_url(self, entry_id: str, source: str) -> Optional[str]:
        now = time.time()

        try:
            cursor = self.connection.execute("""
                SELECT video_url, created_at, expires_at
                FROM video_url_cache
                WHERE entry_id = ? AND source = ? AND expires_at > ?
            """, (entry_id, source, now))

            row = cursor.fetchone()
            if row:
                video_url, created_at, expires_at = row
                age_seconds = int(now - created_at)
                expires_in = int(expires_at - now)

                print(f"[CACHE] Video URL cache HIT for {entry_id} (age: {age_seconds}s, expires in: {expires_in}s)")
                return video_url

            print(f"[CACHE] Video URL cache MISS for {entry_id}")
            return None

        except sqlite3.Error as e:
            print(f"[CACHE] Error retrieving video URL for {entry_id}: {e}")
            return None

    def cache_search_results(self, query: str, results: Dict[str, Any], ttl_seconds: int = 1800):
        """
        Cache search results

        Args:
            query: Search query string
            results: Search results to cache
            ttl_seconds: Time to live in seconds (default 30 minutes)
        """
        query_hash = hashlib.sha256(query.lower().encode()).hexdigest()
        now = time.time()
        expires_at = now + ttl_seconds

        try:
            results_json = json.dumps(results)

            self.connection.execute("""
                INSERT OR REPLACE INTO search_cache
                (query_hash, query, results, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
            """, (query_hash, query, results_json, now, expires_at))
            self.connection.commit()

            print(f"[CACHE] Stored search results for '{query}' (expires in {ttl_seconds}s)")

        except sqlite3.Error as e:
            print(f"[CACHE] Error storing search results for '{query}': {e}")

    def get_search_results(self, query: str) -> Optional[Dict[str, Any]]:
        query_hash = hashlib.sha256(query.lower().encode()).hexdigest()
        now = time.time()

        try:
            cursor = self.connection.execute("""
                SELECT results, created_at, expires_at
                FROM search_cache
                WHERE query_hash = ? AND expires_at > ?
            """, (query_hash, now))

            row = cursor.fetchone()
            if row:
                results_json, created_at, expires_at = row
                age_seconds = int(now - created_at)
                expires_in = int(expires_at - now)

                print(f"[CACHE] Search cache HIT for '{query}' (age: {age_seconds}s, expires in: {expires_in}s)")
                return json.loads(results_json)

            print(f"[CACHE] Search cache MISS for '{query}'")
            return None

        except (sqlite3.Error, json.JSONDecodeError) as e:
            print(f"[CACHE] Error retrieving search results for '{query}': {e}")
            return None

    def cleanup_expired(self):
        now = time.time()

        try:
            # Clean up expired video URLs
            cursor = self.connection.execute("""
                DELETE FROM video_url_cache WHERE expires_at <= ?
            """, (now,))
            video_deleted = cursor.rowcount

            # Clean up expired search results
            cursor = self.connection.execute("""
                DELETE FROM search_cache WHERE expires_at <= ?
            """, (now,))
            search_deleted = cursor.rowcount

            self.connection.commit()

            if video_deleted > 0 or search_deleted > 0:
                print(f"[CACHE] Cleaned up {video_deleted} expired video URLs and {search_deleted} expired search results")

        except sqlite3.Error as e:
            print(f"[CACHE] Error during cleanup: {e}")

    def get_stats(self) -> Dict[str, Any]:
        try:
            # Video URL cache stats
            video_cursor = self.connection.execute("""
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN video_url IS NOT NULL THEN 1 END) as hits,
                    COUNT(CASE WHEN video_url IS NULL THEN 1 END) as misses
                FROM video_url_cache
                WHERE expires_at > ?
            """, (time.time(),))
            video_stats = video_cursor.fetchone()

            # Search cache stats
            search_cursor = self.connection.execute("""
                SELECT COUNT(*) FROM search_cache WHERE expires_at > ?
            """, (time.time(),))
            search_count = search_cursor.fetchone()[0]

            return {
                "video_cache": {
                    "total": video_stats[0],
                    "hits": video_stats[1],
                    "misses": video_stats[2]
                },
                "search_cache": {
                    "total": search_count
                },
                "db_path": str(self.db_path)
            }

        except sqlite3.Error as e:
            print(f"[CACHE] Error getting stats: {e}")
            return {"error": str(e)}

    def cleanup(self):
        try:
            if hasattr(self, 'connection'):
                self.connection.close()
            if hasattr(self, 'db_path') and self.db_path.exists():
                self.db_path.unlink()
            if hasattr(self, 'temp_dir') and os.path.exists(self.temp_dir):
                os.rmdir(self.temp_dir)

            print("[CACHE] Cleaned up temporary cache database")

        except Exception as e:
            print(f"[CACHE] Error during cleanup: {e}")

# This will be set by the FastAPI lifespan context
_app_cache_store: Optional[CacheStore] = None

def get_cache_store() -> CacheStore:
    """Get the cache store instance managed by FastAPI lifespan"""
    if _app_cache_store is None:
        raise RuntimeError("Cache store not initialized. This should be called within FastAPI context.")
    return _app_cache_store

def set_cache_store(cache_store: CacheStore) -> None:
    """Set the cache store instance (called by FastAPI lifespan)"""
    global _app_cache_store
    _app_cache_store = cache_store

def clear_cache_store() -> None:
    """Clear the cache store instance (called by FastAPI lifespan)"""
    global _app_cache_store
    _app_cache_store = None
import time
from collections import deque


class SlidingWindowLimiter:
    """Allows `limit` events per `window_seconds` for each key."""

    def __init__(self):
        self._windows: dict[str, deque] = {}

    def allow(self, key: str, limit: int, window_seconds: float) -> bool:
        now = time.time()
        window = self._windows.setdefault(key, deque())

        while window and now - window[0] > window_seconds:
            window.popleft()

        if len(window) >= limit:
            return False

        window.append(now)
        return True

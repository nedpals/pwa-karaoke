import pytest

import rate_limit
from rate_limit import SlidingWindowLimiter


@pytest.fixture
def clock(monkeypatch):
    """A fake clock. Set clock[0] to the time you want, in seconds."""
    now = [1000.0]
    monkeypatch.setattr(rate_limit.time, "time", lambda: now[0])
    return now


def test_allows_events_up_to_the_limit(clock):
    limiter = SlidingWindowLimiter()

    results = [limiter.allow("user", limit=3, window_seconds=10) for _ in range(3)]

    assert results == [True, True, True]


def test_blocks_the_event_over_the_limit(clock):
    limiter = SlidingWindowLimiter()
    for _ in range(3):
        limiter.allow("user", limit=3, window_seconds=10)

    assert limiter.allow("user", limit=3, window_seconds=10) is False


def test_allows_again_after_the_window_has_passed(clock):
    limiter = SlidingWindowLimiter()
    for _ in range(3):
        limiter.allow("user", limit=3, window_seconds=10)

    clock[0] += 11

    assert limiter.allow("user", limit=3, window_seconds=10) is True


def test_still_blocked_inside_the_window(clock):
    limiter = SlidingWindowLimiter()
    for _ in range(3):
        limiter.allow("user", limit=3, window_seconds=10)

    clock[0] += 5

    assert limiter.allow("user", limit=3, window_seconds=10) is False


def test_keys_are_limited_separately(clock):
    limiter = SlidingWindowLimiter()
    limiter.allow("alice", limit=1, window_seconds=10)

    assert limiter.allow("alice", limit=1, window_seconds=10) is False
    assert limiter.allow("bob", limit=1, window_seconds=10) is True


def test_blocked_attempts_do_not_extend_the_window(clock):
    limiter = SlidingWindowLimiter()
    limiter.allow("user", limit=1, window_seconds=10)

    clock[0] += 5
    limiter.allow("user", limit=1, window_seconds=10)  # blocked
    clock[0] += 6

    assert limiter.allow("user", limit=1, window_seconds=10) is True

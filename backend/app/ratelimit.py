"""Keep every NVIDIA API under its free-tier limit (~40 requests/min per model or speech function).

Each API (model id or function id) gets a sliding-window budget, NVIDIA_RPM_LIMIT per minute (default 36, leaving
headroom). A call that would exceed it waits for a free slot instead of failing; if the wait would be longer than
`max_wait`, it raises Busy so the endpoint can answer 503 (and the frontend can fall back, e.g. browser TTS).
Transient errors (429, 5xx, timeouts) are retried with backoff, and every retry also spends a slot.

Budgets live in this process: run uvicorn with ONE worker (the default) or the limits multiply.
"""
import random
import threading
import time
from collections import deque
from collections.abc import Callable
from typing import TypeVar

from .config import get_settings

T = TypeVar("T")


class Busy(Exception):
    """The API's budget is used up for longer than the caller is willing to wait."""


class Limiter:
    def __init__(self, per_minute: int, window: float = 60.0):
        self.per_minute, self.window = per_minute, window
        self._calls: deque[float] = deque()
        self._lock = threading.Lock()

    def _prune(self, now: float) -> None:
        while self._calls and now - self._calls[0] >= self.window:
            self._calls.popleft()

    def acquire(self, max_wait: float) -> None:
        deadline = time.monotonic() + max_wait
        while True:
            with self._lock:
                now = time.monotonic()
                self._prune(now)
                if len(self._calls) < self.per_minute:
                    self._calls.append(now)
                    return
                wait = self._calls[0] + self.window - now
            if now + wait > deadline:
                raise Busy(f"rate budget used up; next slot in {wait:.0f}s")
            time.sleep(min(wait, 1.0) + random.uniform(0, 0.05))

    def used(self) -> int:
        with self._lock:
            self._prune(time.monotonic())
            return len(self._calls)


_limiters: dict[str, Limiter] = {}
_registry_lock = threading.Lock()


def limiter(api: str) -> Limiter:
    with _registry_lock:
        if api not in _limiters:
            _limiters[api] = Limiter(get_settings().rpm_limit)
        return _limiters[api]


def usage() -> dict[str, str]:
    """For /health: requests spent in the last minute per API."""
    return {api: f"{lim.used()}/{lim.per_minute}" for api, lim in _limiters.items()}


def call(api: str, fn: Callable[[], T], *, is_transient: Callable[[Exception], bool], max_wait: float = 25.0,
         retries: int = 3) -> T:
    """Run fn() inside api's budget, retrying transient failures with exponential backoff (1 s, 2 s, 4 s + jitter)."""
    for attempt in range(retries + 1):
        limiter(api).acquire(max_wait)
        try:
            return fn()
        except Exception as e:
            if attempt == retries or not is_transient(e):
                raise
            time.sleep(2**attempt + random.uniform(0, 0.5))
    raise AssertionError("unreachable")

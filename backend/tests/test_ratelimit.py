"""Limiter behaviour without touching NVIDIA. From backend/: ../.venv/Scripts/python -m pytest tests"""
import threading
import time

import pytest

from app import ratelimit


def test_never_exceeds_budget_under_concurrent_load():
    lim = ratelimit.Limiter(per_minute=5, window=1.0)
    stamps: list[float] = []
    lock = threading.Lock()

    def worker():
        lim.acquire(max_wait=10)
        with lock:
            stamps.append(time.monotonic())

    threads = [threading.Thread(target=worker) for _ in range(15)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    stamps.sort()
    assert len(stamps) == 15
    # In any 1 s window there are at most 5 calls.
    for i in range(len(stamps) - 5):
        assert stamps[i + 5] - stamps[i] >= 0.99
    assert stamps[-1] - stamps[0] >= 1.98  # 15 calls at 5/s need at least two full windows


def test_busy_when_wait_too_long():
    lim = ratelimit.Limiter(per_minute=2, window=5.0)
    lim.acquire(0)
    lim.acquire(0)
    t = time.monotonic()
    with pytest.raises(ratelimit.Busy):
        lim.acquire(max_wait=1.0)
    assert time.monotonic() - t < 0.1  # fails fast instead of sleeping


class Flaky(Exception):
    pass


def test_retries_transient_then_succeeds(monkeypatch):
    monkeypatch.setattr(ratelimit.time, "sleep", lambda s: None)
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        if calls["n"] < 3:
            raise Flaky("429")
        return "ok"

    assert ratelimit.call("test:flaky", fn, is_transient=lambda e: isinstance(e, Flaky)) == "ok"
    assert calls["n"] == 3
    assert ratelimit.limiter("test:flaky").used() == 3  # every attempt spends budget


def test_non_transient_is_not_retried():
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        raise ValueError("bad request")

    with pytest.raises(ValueError):
        ratelimit.call("test:fatal", fn, is_transient=lambda e: False)
    assert calls["n"] == 1

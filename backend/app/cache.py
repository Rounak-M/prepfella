"""Disk cache for AI replies and TTS audio (backend/tmp/cache). Same input → no API call, so rehearsals and repeated
demo runs cost no quota. Delete the folder to clear it."""
import hashlib
import json
from pathlib import Path

from .config import ROOT

DIR = ROOT / "backend" / "tmp" / "cache"


def key(*parts: object) -> str:
    return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()[:32]


def _path(kind: str, k: str, ext: str) -> Path:
    return DIR / kind / f"{k}.{ext}"


def get_json(kind: str, k: str) -> dict | None:
    p = _path(kind, k, "json")
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
    except (OSError, ValueError):
        return None


def put_json(kind: str, k: str, value: dict) -> None:
    p = _path(kind, k, "json")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value), encoding="utf-8")


def get_bytes(kind: str, k: str, ext: str) -> bytes | None:
    p = _path(kind, k, ext)
    return p.read_bytes() if p.exists() else None


def put_bytes(kind: str, k: str, ext: str, value: bytes) -> None:
    p = _path(kind, k, ext)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(value)

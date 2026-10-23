"""Settings read from the repo-root .env file (copy .env.example to .env)."""
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    nvidia_api_key: str
    nim_base_url: str
    model_fast: str  # live interview turns: question + scoring, needs low latency
    model_deep: str  # profile review, session report: quality over speed
    riva_server: str
    tts_api_key: str  # optional separate key for Magpie TTS; falls back to nvidia_api_key
    tts_function_id: str
    tts_voice: str
    tts_sample_rate: int
    asr_function_id: str
    database_url: str
    rpm_limit: int  # per NVIDIA API (model / speech function), see ratelimit.py
    frontend_origin: str


@lru_cache
def get_settings() -> Settings:
    env = os.getenv
    return Settings(
        nvidia_api_key=env("NVIDIA_API_KEY", ""),
        nim_base_url=env("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
        model_fast=env("NIM_MODEL_FAST", ""),
        model_deep=env("NIM_MODEL_DEEP", ""),
        riva_server=env("RIVA_SERVER", "grpc.nvcf.nvidia.com:443"),
        tts_api_key=env("TTS_API_KEY", "") or env("NVIDIA_API_KEY", ""),
        tts_function_id=env("TTS_FUNCTION_ID", ""),
        tts_voice=env("TTS_VOICE", "Magpie-Multilingual.EN-US.Aria"),
        tts_sample_rate=int(env("TTS_SAMPLE_RATE", "22050")),
        asr_function_id=env("ASR_FUNCTION_ID", ""),
        database_url=env("DATABASE_URL", "") or f"sqlite:///{(ROOT / 'backend' / 'prepfella.db').as_posix()}",
        rpm_limit=int(env("NVIDIA_RPM_LIMIT", "36")),
        frontend_origin=env("FRONTEND_ORIGIN", "http://localhost:3000"),
    )

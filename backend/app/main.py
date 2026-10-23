from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import models  # noqa: F401  (registers tables on Base)
from . import ratelimit
from .config import get_settings
from .db import Base, SessionLocal, engine
from .routers import advice, assistant, career, linkedin, profile, sessions
from .users import migrate, router as users_router, seed_demo_accounts


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    migrate(engine)
    with SessionLocal() as db:
        seed_demo_accounts(db)
    yield


app = FastAPI(title="PrepFella API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ratelimit.Busy)
def busy(_: Request, e: ratelimit.Busy) -> JSONResponse:
    # An NVIDIA API budget is full. The frontend shows "busy, retrying" (or uses browser TTS) instead of an error.
    return JSONResponse({"detail": {"code": "busy", "message": f"AI is busy right now ({e}). Try again in a moment."}},
                        status_code=503, headers={"Retry-After": "10"})


app.include_router(users_router)
app.include_router(linkedin.router)
app.include_router(career.router)
app.include_router(profile.router)
app.include_router(sessions.router)
app.include_router(assistant.router)
app.include_router(advice.router)


@app.get("/health")
def health() -> dict:
    s = get_settings()
    return {
        "ok": True,
        "nvidia_key_set": bool(s.nvidia_api_key),
        "models": {"fast": s.model_fast or None, "deep": s.model_deep or None},
        "tts_configured": bool(s.tts_function_id),
        "asr_configured": bool(s.asr_function_id),
        "database": s.database_url.split(":", 1)[0],
        "rate_budget_last_minute": ratelimit.usage(),
    }

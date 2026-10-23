"""Mock interviews: create → answer (text or WAV) × N → finish → report. One LLM call per answer (§4.2), the adaptive
engine picks the next move (§4.3), the report is written once at the end (§4.4). Every AI step has a fallback so an
interview never dead-ends: the static question bank, neutral scores, a template report."""
import io
import json
import random
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import ratelimit, speech
from ..db import get_db
from ..engine import adaptive
from ..engine.metrics import answer_metrics
from ..llm import try_chat_json
from ..models import InterviewSession, Profile, Turn, User
from ..prompts import interview as iprompt
from ..prompts import report as rprompt
from ..users import current_user

router = APIRouter(tags=["sessions"])

DIMENSIONS = ("communication", "technical", "problem_solving", "answer_quality")
_DIFFICULTY = {"easy": 2, "medium": 3, "hard": 4}
_BANK = json.loads((Path(__file__).resolve().parents[1] / "fallback_bank.json").read_text(encoding="utf-8"))


# --- helpers -----------------------------------------------------------------------------------------------------

def _bank_key(role: str) -> str:
    r = role.lower()
    for key, words in {"security": ("secur", "cyber", "soc", "pentest"), "data": ("data", "analyst", "scien", "ml"),
                       "frontend": ("front", "react", "ui", "web"), "backend": ("back", "api", "server", "software")}.items():
        if any(w in r for w in words):
            return key
    return "default"


def bank_question(role: str, kind: str, used: list[str]) -> dict:
    pool = _BANK["hr"] if kind == "hr" else _BANK[_bank_key(role)] + (_BANK["hr"] if kind == "mixed" else [])
    fresh = [q for q in pool if q["question"] not in used] or pool
    return random.choice(fresh)


def _own(db: Session, user: User, session_id: int) -> InterviewSession:
    s = db.get(InterviewSession, session_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(404, "No such interview")
    return s


def _turns(db: Session, s: InterviewSession) -> list[Turn]:
    return list(db.scalars(select(Turn).where(Turn.session_id == s.id).order_by(Turn.idx)))


def turn_out(t: Turn, *, reveal: bool = True) -> dict:
    out = {"idx": t.idx, "kind": t.kind, "topic": t.topic, "question": t.question, "difficulty": t.difficulty,
           "label": (t.decision or {}).get("asked_as"), "answered": t.answer_text is not None}
    if reveal and t.answer_text is not None:
        out |= {"answer_text": t.answer_text, "answer_seconds": t.answer_seconds, "wpm": t.wpm, "filler_count": t.filler_count,
                "scores": t.scores, "evidence": t.evidence, "feedback": t.feedback, "decision": t.decision}
    return out


def overall(scores: dict | None) -> int | None:
    return round(10 * sum(scores.values()) / len(scores)) if scores else None


def session_out(s: InterviewSession, turns: list[Turn] | None = None) -> dict:
    out = {"id": s.id, "role": s.role, "level": s.level, "interview_type": s.interview_type, "difficulty": s.difficulty,
           "mode": s.mode, "status": s.status, "question_count": s.question_count, "current_difficulty": s.current_difficulty,
           "started_at": s.started_at, "ended_at": s.ended_at,
           "overall": (s.report or {}).get("overall"), "averages": (s.report or {}).get("averages")}
    if turns is not None:
        out["turns"] = [turn_out(t) for t in turns]
        out["report"] = s.report
    return out


def _wav_seconds(data: bytes) -> float | None:
    try:
        with wave.open(io.BytesIO(data)) as w:
            return w.getnframes() / w.getframerate()
    except (wave.Error, EOFError):
        return None


# --- create ------------------------------------------------------------------------------------------------------

class SessionIn(BaseModel):
    role: str = Field(min_length=2, max_length=100)
    level: str = Field(min_length=2, max_length=50)
    interview_type: Literal["technical", "hr", "mixed"]
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    mode: Literal["voice", "text"] = "text"
    question_count: int = Field(5, ge=2, le=12)
    topics: list[str] | None = None  # e.g. from a report's next_session; default = profile review's plan


@router.post("/sessions")
def create_session(body: SessionIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    profile = db.get(Profile, user.id)
    review = (profile.review if profile else None) or {}
    plan = review.get("interview_plan") or []
    wanted = {"technical": ("technical",), "hr": ("hr",), "mixed": ("technical", "hr")}[body.interview_type]
    topics = body.topics or [t["topic"] for t in plan if t.get("kind", "technical") in wanted]
    claims = review.get("resume_claims") or []
    diff = _DIFFICULTY[body.difficulty]

    first = try_chat_json(iprompt.OPENING_SYSTEM, iprompt.opening_user(
        role=body.role, level=body.level, kind=body.interview_type, difficulty=diff, topics=topics, claims=claims),
        temperature=0.7, max_tokens=200, use_cache=False)
    if not first or not first.get("question"):
        first = bank_question(body.role, body.interview_type, [])

    s = InterviewSession(user_id=user.id, **body.model_dump(exclude={"topics"}), current_difficulty=diff,
                         context={"topics": topics, "claims": claims, "probed": [], "gaps": [], "covered": []})
    db.add(s)
    db.flush()
    t = Turn(session_id=s.id, idx=0, kind="main", topic=first.get("topic") or (topics[0] if topics else "General"),
             question=first["question"].strip(), difficulty=diff, decision={"asked_as": "Opening question"})
    db.add(t)
    db.commit()
    return session_out(s, [t])


# --- read --------------------------------------------------------------------------------------------------------

@router.get("/sessions")
def list_sessions(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(InterviewSession).where(InterviewSession.user_id == user.id).order_by(InterviewSession.started_at.desc()))
    return [session_out(s) for s in rows]


@router.get("/sessions/{session_id}")
def get_session(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    s = _own(db, user, session_id)
    return session_out(s, _turns(db, s))


@router.get("/sessions/{session_id}/turns/{idx}/audio")
def question_audio(session_id: int, idx: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    """Interviewer voice (WAV, cached on disk). 503 when TTS is busy: the browser then speaks the question itself."""
    s = _own(db, user, session_id)
    t = db.scalar(select(Turn).where(Turn.session_id == s.id, Turn.idx == idx))
    if t is None:
        raise HTTPException(404, "No such question")
    try:
        wav = speech.synthesize(t.question)
    except ratelimit.Busy:
        raise
    except Exception as e:  # gRPC errors after retries
        raise HTTPException(503, {"code": "tts_unavailable", "message": str(e)[:200]})
    return Response(wav, media_type="audio/wav", headers={"Cache-Control": "private, max-age=86400"})


# --- answer ------------------------------------------------------------------------------------------------------

def _clean_scores(raw: dict | None) -> dict:
    out = {}
    for d in DIMENSIONS:
        v = (raw or {}).get(d)
        out[d] = max(1, min(10, round(v))) if isinstance(v, (int, float)) else 5
    return out


@router.post("/sessions/{session_id}/answer")
def answer(session_id: int, text: str = Form(""), seconds: float | None = Form(None), audio: UploadFile | None = File(None),
           user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    """Multipart: `text` (typed or edited transcript) or `audio` (16 kHz mono WAV); optional `seconds` spent answering."""
    s = _own(db, user, session_id)
    if s.status != "active":
        raise HTTPException(409, "This interview is finished")
    turns = _turns(db, s)
    current = next((t for t in turns if t.answer_text is None), None)
    if current is None:
        raise HTTPException(409, "No open question; finish the interview")

    if audio is not None:
        data = audio.file.read()
        seconds = seconds or _wav_seconds(data)
        try:
            text = speech.transcribe(data)
        except ratelimit.Busy:
            raise
        except Exception as e:
            raise HTTPException(503, {"code": "asr_unavailable", "message": f"Speech recognition failed ({str(e)[:120]}). Type your answer instead."})
    text = text.strip()
    metrics = answer_metrics(text, seconds)
    ctx = dict(s.context or {})
    unprobed = [c for c in ctx.get("claims", []) if c not in ctx.get("probed", [])]
    answered_before = [t for t in turns if t.answer_text is not None]

    raw = try_chat_json(iprompt.EVAL_SYSTEM, iprompt.eval_user(
        role=s.role, level=s.level, kind=s.interview_type, difficulty=current.difficulty, question=current.question,
        topic=current.topic, answer=text, metrics=metrics, claims=unprobed, covered=ctx.get("covered", []),
        planned=ctx.get("topics", [])), max_tokens=1400, use_cache=False)
    ai_ok = raw is not None
    raw = raw or {}
    scores = _clean_scores(raw.get("scores"))
    if not text:
        scores = {d: 1 for d in DIMENSIONS}
    evidence = raw.get("evidence") if isinstance(raw.get("evidence"), dict) else {d: "AI scoring was unavailable for this answer." for d in DIMENSIONS}
    candidates = raw.get("candidates") if isinstance(raw.get("candidates"), dict) else {}
    touched = raw.get("touched_claim") if raw.get("touched_claim") in unprobed else None

    decision = adaptive.decide(scores, candidates, last_kind=current.kind, difficulty=current.difficulty,
                               topic=current.topic, claim=touched)
    used = [t.question for t in turns]
    if not decision["question"] or decision["question"] in used:
        q = bank_question(s.role, s.interview_type, used)
        decision.update(move="new_topic", kind="main", question=q["question"], topic=q["topic"], label=adaptive.LABELS["new_topic"],
                        reason=decision["reason"] if ai_ok else "Next question from the practice bank.")

    current.answer_text = text
    current.answer_seconds = metrics["seconds"]
    current.wpm = metrics["wpm"]
    current.filler_count = metrics["filler_count"]
    current.scores = scores
    current.evidence = evidence
    current.feedback = raw.get("feedback") or ""
    current.decision = {**(current.decision or {}), **{k: decision[k] for k in ("move", "label", "reason", "avg")},
                        "missing_points": raw.get("missing_points") or [], "metrics": metrics, "ai": ai_ok}

    ctx["covered"] = sorted(set(ctx.get("covered", [])) | {current.topic})
    if touched:
        ctx["probed"] = [*ctx.get("probed", []), touched]
    if decision["move"] == "easier":
        ctx["gaps"] = sorted(set(ctx.get("gaps", [])) | {current.topic})
    s.context = ctx
    s.current_difficulty = decision["difficulty"]

    done = len(answered_before) + 1 >= s.question_count
    nxt = None
    if not done:
        nxt = Turn(session_id=s.id, idx=current.idx + 1, kind=decision["kind"], topic=decision["topic"] or current.topic,
                   question=decision["question"].strip(), difficulty=decision["difficulty"],
                   decision={"asked_as": decision["label"], "because": decision["reason"]})
        db.add(nxt)
    db.commit()
    return {"transcript": text, "evaluation": turn_out(current), "next": turn_out(nxt) if nxt else None, "done": done}


# --- finish ------------------------------------------------------------------------------------------------------

@router.post("/sessions/{session_id}/finish")
def finish(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    s = _own(db, user, session_id)
    turns = _turns(db, s)
    answered = [t for t in turns if t.answer_text is not None]
    if s.status == "finished" and s.report:
        return session_out(s, turns)
    if not answered:
        raise HTTPException(422, "Answer at least one question first")
    for t in turns:  # drop the unanswered question if the candidate stopped early
        if t.answer_text is None:
            db.delete(t)

    averages = {d: round(sum(t.scores[d] for t in answered) / len(answered), 1) for d in DIMENSIONS}
    weakest = min(averages, key=averages.get)
    gaps = (s.context or {}).get("gaps", [])
    payload = [{"question": t.question, "kind": t.kind, "topic": t.topic, "answer": (t.answer_text or "")[:1200],
                "scores": t.scores, "evidence": t.evidence, "feedback": t.feedback} for t in answered]
    raw = try_chat_json(rprompt.SYSTEM, rprompt.user_prompt(role=s.role, level=s.level, kind=s.interview_type,
                                                           averages=averages, weakest=weakest, turns=payload, gaps=gaps),
                        deep=True, max_tokens=2500, use_cache=False) or {}
    worst = sorted(answered, key=lambda t: sum(t.scores.values()))[:2]
    s.report = {
        "averages": averages,
        "overall": overall(averages),
        "weakest": weakest,
        "summary": raw.get("summary") or f"You answered {len(answered)} questions. Your weakest area was {weakest.replace('_', ' ')}.",
        "strengths": raw.get("strengths") or [],
        "top_fixes": (raw.get("top_fixes") or [t.feedback for t in worst if t.feedback])[:3],
        "model_answers": [m for m in raw.get("model_answers") or [] if isinstance(m, dict)][:2],
        "next_session": raw.get("next_session") or {"difficulty": s.difficulty, "topics": gaps or [worst[0].topic], "count": 5,
                                                     "type": s.interview_type},
        "study_plan": [p for p in raw.get("study_plan") or [] if isinstance(p, dict)][:4],
        "adaptive": [{"idx": t.idx, "question": t.question, "asked_as": (t.decision or {}).get("asked_as"),
                      "move_after": (t.decision or {}).get("label"), "reason": (t.decision or {}).get("reason")} for t in answered],
        "gaps": gaps,
        "ai": bool(raw),
    }
    s.status = "finished"
    s.ended_at = datetime.now(timezone.utc)
    db.commit()
    return session_out(s, _turns(db, s))


@router.get("/progress")
def progress(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Finished sessions in order, with per-dimension averages — for the dashboard trend chart."""
    rows = db.scalars(select(InterviewSession).where(InterviewSession.user_id == user.id, InterviewSession.status == "finished")
                      .order_by(InterviewSession.ended_at))
    return [{"session_id": s.id, "date": s.ended_at, "role": s.role, "interview_type": s.interview_type,
             "averages": s.report["averages"], "overall": s.report["overall"]} for s in rows if s.report]

"""Fella, the in-app coach (§4.5). Context assembled in SQL from the user's own data; no vectors (stretch)."""
import json

import openai
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import get_db
from .. import ratelimit
from ..llm import chat_text, log
from ..models import AssistantMessage, CareerEntry, InterviewSession, Profile, Turn, User
from ..prompts import fella
from ..users import current_user

router = APIRouter(prefix="/assistant", tags=["assistant"])


def user_context(db: Session, user: User) -> dict:
    profile = db.get(Profile, user.id)
    review = (profile.review if profile else None) or {}
    sessions = list(db.scalars(select(InterviewSession).where(InterviewSession.user_id == user.id, InterviewSession.status == "finished")
                               .order_by(InterviewSession.ended_at.desc())))
    last = sessions[0] if sessions else None
    turns = list(db.scalars(select(Turn).join(InterviewSession).where(InterviewSession.user_id == user.id, Turn.scores.is_not(None))))
    weakest = sorted(turns, key=lambda t: sum(t.scores.values()))[:3]
    li = (profile.linkedin_review if profile else None) or {}
    return {
        # Empty target_role/level = not set by the candidate: infer from what they entered below, don't assume.
        "candidate": {"name": user.name, "target_role": (profile.target_role if profile else "") or "(not set)",
                      "level": (profile.experience_level if profile else "") or "(not set)"},
        # What they entered themselves: the richest signal for their direction and skills.
        "resume_text": (profile.resume_text[:2500] if profile and profile.resume_text else None),
        "linkedin_profile_text": (profile.linkedin_text[:3000] if profile and profile.linkedin_text else None),
        "roles_practised": sorted({s.role for s in sessions}),
        "profile_review": {k: review.get(k) for k in ("role_fit", "strengths", "gaps", "red_flags")} if review else None,
        "interviews_done": len(sessions),
        "score_trend": [{"date": str(s.ended_at)[:10], "overall": (s.report or {}).get("overall")} for s in reversed(sessions)],
        "last_report": {k: (last.report or {}).get(k) for k in ("overall", "averages", "weakest", "summary", "top_fixes", "next_session")}
                       | {"role": last.role, "type": last.interview_type} if last else None,
        "weakest_answers": [{"question": t.question, "answer": (t.answer_text or "")[:500], "scores": t.scores,
                             "evidence": t.evidence, "feedback": t.feedback} for t in weakest],
        "career": [{"title": e.title, "org": e.organization, "from": e.start, "to": e.end or "present", "kind": e.kind}
                   for e in db.scalars(select(CareerEntry).where(CareerEntry.user_id == user.id).order_by(CareerEntry.start))],
        "linkedin_review": {"overall": li.get("overall"), "top_fixes": li.get("top_fixes")} if li else None,
    }


def message_out(m: AssistantMessage) -> dict:
    return {"id": m.id, "role": m.role, "content": m.content, "quiz": m.quiz, "created_at": m.created_at}


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


@router.get("/messages")
def messages(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(AssistantMessage).where(AssistantMessage.user_id == user.id, AssistantMessage.channel == "coach")
                       .order_by(AssistantMessage.id))
    return [message_out(m) for m in rows]


@router.delete("/messages")
def clear(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    db.execute(delete(AssistantMessage).where(AssistantMessage.user_id == user.id, AssistantMessage.channel == "coach"))
    db.commit()
    return {"ok": True}


@router.post("/chat")
def chat(body: ChatIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    history = list(db.scalars(select(AssistantMessage).where(AssistantMessage.user_id == user.id, AssistantMessage.channel == "coach")
                              .order_by(AssistantMessage.id.desc()).limit(10)))[::-1]
    convo = "\n".join(
        f"{'Candidate' if m.role == 'user' else 'Fella'}: {m.content}" + (f"\n[Fella's quiz: {m.quiz['question']}]" if m.quiz else "")
        for m in history
    )
    prompt = (f"CANDIDATE DATA\n{json.dumps(user_context(db, user), default=str)[:12000]}\n\n"
              f"CONVERSATION SO FAR\n{convo or '(none)'}\n\nCandidate: {body.message}")
    try:
        text, quiz = fella.parse_reply(chat_text(fella.SYSTEM, prompt, max_tokens=700, temperature=0.5))
    except (openai.APIError, ratelimit.Busy) as e:
        log.warning("Fella unavailable: %s", e)
        text, quiz = "", None
    if not text:
        raise HTTPException(503, {"code": "busy", "message": "Fella is catching their breath. Try again in a few seconds."})
    mine = AssistantMessage(user_id=user.id, role="user", content=body.message)
    reply = AssistantMessage(user_id=user.id, role="assistant", content=text, quiz=quiz)
    db.add_all([mine, reply])
    db.commit()
    return {"user": message_out(mine), "assistant": message_out(reply)}

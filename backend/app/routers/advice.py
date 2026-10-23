"""Advice: a dedicated chat where Fella turns a goal role or topics into a learning roadmap with free resources."""
import json

import openai
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .. import ratelimit
from ..db import get_db
from ..llm import chat_text, log
from ..models import AssistantMessage, User
from ..prompts import advice
from ..users import current_user
from .assistant import user_context

router = APIRouter(prefix="/advice", tags=["advice"])


def message_out(m: AssistantMessage) -> dict:
    return {"id": m.id, "role": m.role, "content": m.content, "resources": m.resources or [], "created_at": m.created_at}


def _history(db: Session, user: User, limit: int | None = None) -> list[AssistantMessage]:
    q = select(AssistantMessage).where(AssistantMessage.user_id == user.id, AssistantMessage.channel == "advice")
    if limit:
        return list(db.scalars(q.order_by(AssistantMessage.id.desc()).limit(limit)))[::-1]
    return list(db.scalars(q.order_by(AssistantMessage.id)))


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


@router.get("/messages")
def messages(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    return [message_out(m) for m in _history(db, user)]


@router.delete("/messages")
def clear(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    db.execute(delete(AssistantMessage).where(AssistantMessage.user_id == user.id, AssistantMessage.channel == "advice"))
    db.commit()
    return {"ok": True}


@router.post("/chat")
def chat(body: ChatIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    history = _history(db, user, limit=8)
    ctx = user_context(db, user)
    # Pick catalog candidates from the goal itself, recent turns and the profile (target role, resume gaps).
    hints = " ".join([body.message, *[m.content for m in history if m.role == "user"][-3:],
                      ctx["candidate"].get("target_role") or "", *((ctx.get("profile_review") or {}).get("gaps") or [])])
    convo = "\n".join(f"{'Candidate' if m.role == 'user' else 'Fella'}: {m.content}" for m in history)
    prompt = (f"CANDIDATE DATA\n{json.dumps(ctx, default=str)[:6000]}\n\n"
              f"RESOURCE CATALOG (id | title | provider | type | tags)\n{advice.catalog_block(advice.candidates(hints))}\n\n"
              f"CONVERSATION SO FAR\n{convo or '(none)'}\n\nCandidate: {body.message}")
    try:
        text, resources = advice.parse_reply(chat_text(advice.SYSTEM, prompt, max_tokens=1400, temperature=0.5))
    except (openai.APIError, ratelimit.Busy) as e:
        log.warning("Advice unavailable: %s", e)
        text, resources = "", []
    if not text:
        raise HTTPException(503, {"code": "busy", "message": "Fella is busy planning someone else's future. Try again in a few seconds."})
    mine = AssistantMessage(user_id=user.id, channel="advice", role="user", content=body.message)
    reply = AssistantMessage(user_id=user.id, channel="advice", role="assistant", content=text, resources=resources)
    db.add_all([mine, reply])
    db.commit()
    return {"user": message_out(mine), "assistant": message_out(reply)}

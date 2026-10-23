"""Profile: target role/level/links, resume upload (PDF or pasted text) and the AI Profile Review (§4.1)."""
from datetime import datetime, timezone

import pymupdf
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..llm import try_chat_json
from ..models import Profile, User
from ..prompts import profile_review as prompt
from ..users import current_user

router = APIRouter(prefix="/profile", tags=["profile"])


def get_profile(db: Session, user: User) -> Profile:
    profile = db.get(Profile, user.id)
    if profile is None:
        profile = Profile(user_id=user.id, links={})
        db.add(profile)
        db.flush()
    return profile


def profile_out(p: Profile) -> dict:
    return {
        "target_role": p.target_role, "experience_level": p.experience_level, "links": p.links or {},
        "has_resume": bool(p.resume_text), "resume_chars": len(p.resume_text or ""), "resume_preview": (p.resume_text or "")[:600],
        "review": p.review, "reviewed_at": p.reviewed_at,
        "linkedin_overall": (p.linkedin_review or {}).get("overall"),
    }


class ProfileIn(BaseModel):
    target_role: str | None = Field(None, max_length=100)
    experience_level: str | None = Field(None, max_length=50)
    links: dict[str, str] | None = None


@router.get("")
def read_profile(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return profile_out(get_profile(db, user))


@router.put("")
def update_profile(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    p = get_profile(db, user)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    return profile_out(p)


@router.post("/resume")
def upload_resume(pdf: UploadFile | None = File(None), text: str = Form(""), user: User = Depends(current_user),
                  db: Session = Depends(get_db)) -> dict:
    """Resume as a PDF upload or pasted text. Replaces the previous one and clears its review."""
    if pdf is not None:
        try:
            with pymupdf.open(stream=pdf.file.read(), filetype="pdf") as doc:
                text = "\n".join(page.get_text() for page in doc)
        except Exception:
            raise HTTPException(422, "Could not read that PDF")
    text = text.strip()
    if len(text) < 200:
        raise HTTPException(422, "The resume has too little text to review (is it a scanned image?)")
    p = get_profile(db, user)
    p.resume_text, p.review, p.reviewed_at = text[:20000], None, None
    db.commit()
    return profile_out(p)


@router.post("/review")
def review_profile(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    p = get_profile(db, user)
    if not p.resume_text:
        raise HTTPException(422, "Upload your resume first")
    raw = try_chat_json(prompt.SYSTEM, prompt.user_prompt(resume=p.resume_text, role=p.target_role,
                                                          level=p.experience_level, links=p.links or {}),
                        deep=True, max_tokens=2500)
    if raw is None:
        raise HTTPException(503, {"code": "busy", "message": "The AI is busy right now. Try again in a moment."})
    fit = raw.get("role_fit") or {}
    p.review = {
        "role_fit": {"level": fit.get("level") if fit.get("level") in ("strong", "good", "developing") else "good",
                     "summary": fit.get("summary", "")},
        "strengths": raw.get("strengths") or [],
        "gaps": raw.get("gaps") or [],
        "red_flags": [f for f in raw.get("red_flags") or [] if isinstance(f, dict)],
        "resume_claims": [c for c in raw.get("resume_claims") or [] if isinstance(c, str)][:4],
        "interview_plan": [t for t in raw.get("interview_plan") or [] if isinstance(t, dict) and t.get("topic")][:5],
    }
    p.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return profile_out(p)

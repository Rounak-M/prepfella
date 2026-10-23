"""LinkedIn: AI profile review, and import of positions/education into the career graph.
Input is a pasted link (public page) and/or LinkedIn's "Save to PDF" export."""
from datetime import datetime, timezone

import openai
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import career, linkedin
from ..db import get_db
from ..llm import chat_json
from ..models import CareerEntry, Profile, User
from ..prompts import linkedin_extract as extract
from ..prompts import linkedin_review as prompt
from ..users import current_user
from .career import entry_out

router = APIRouter(prefix="/profile/linkedin", tags=["linkedin"])


def _checks(url: str | None, public: dict | None) -> list[dict]:
    """Deterministic checks shown next to the AI review (not LLM opinion)."""
    out = []
    if url:
        out.append({"label": "Custom profile URL", "ok": linkedin.has_custom_url(url),
                    "tip": "Settings → Edit your custom public profile URL, e.g. /in/firstname-lastname"})
    if public:
        words = len(public["about"].split())
        out += [
            {"label": "Headline says more than 'Student'", "ok": bool(public["headline"]) and public["headline"].lower().split(" at ")[0] not in {"student", "fresher", "intern"},
             "tip": "Lead with the role you want and one specialty"},
            {"label": "About section 150+ words", "ok": words >= 150, "tip": f"Yours has {words} words", "value": f"{words} words"},
            {"label": "At least one role listed", "ok": bool(public["experience"]), "tip": "Add internships, projects or freelance work as positions"},
        ]
        if public["connections"]:
            out.append({"label": "500+ connections", "ok": public["connections"].startswith("500"), "tip": "Connect with classmates, alumni and recruiters"})
    return out


def _review(text: str, source: str, profile: Profile, checks: list[dict]) -> dict:
    user = prompt.user_prompt(text, source=source, target_role=profile.target_role, level=profile.experience_level,
                              facts={c["label"]: c.get("value", c["ok"]) for c in checks})
    for attempt in range(2):  # one retry on unparseable JSON (§4)
        try:
            raw = chat_json(prompt.SYSTEM, user, deep=True, max_tokens=3000)
            break
        except ValueError:
            if attempt:
                raise HTTPException(502, "The AI reply could not be read; try again")
        except openai.APIError as e:
            raise HTTPException(502, f"The AI service failed: {e}")
    sections = {}
    for name in prompt.SECTIONS:
        sec = (raw.get("sections") or {}).get(name)
        if isinstance(sec, dict) and isinstance(sec.get("score"), (int, float)):
            sections[name] = {**sec, "score": max(1, min(10, round(sec["score"])))}
        else:
            sections[name] = None
    # Overall is computed here, weighted over the sections the source actually showed.
    present = {k: w for k, w in prompt.SECTIONS.items() if sections[k]}
    overall = round(10 * sum(sections[k]["score"] * w for k, w in present.items()) / sum(present.values())) if present else None
    return {
        "overall": overall,
        "source": source,
        "sections": sections,
        "strengths": raw.get("strengths") or [],
        "top_fixes": (raw.get("top_fixes") or [])[:3],
        "headline_options": (raw.get("headline_options") or [])[:3],
        "about_rewrite": raw.get("about_rewrite") or "",
        "missing_keywords": raw.get("missing_keywords") or [],
        "checks": checks,
    }


@router.post("")
def review_linkedin(
    url: str = Form(""),
    pdf: UploadFile | None = File(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Needs `url`, `pdf`, or both. The PDF is the richer source; the link adds the custom-URL check.
    422 with detail.code == "linkedin_unavailable" means: ask the user for the PDF export instead."""
    if not url and pdf is None:
        raise HTTPException(422, "Paste your LinkedIn link or upload the PDF export")
    url, public, text, source = _load(url, pdf)
    profile = db.get(Profile, user.id) or Profile(user_id=user.id)
    review = _review(text, source, profile, _checks(url, public))
    _remember(profile, url, text)
    profile.linkedin_review = review
    profile.linkedin_reviewed_at = datetime.now(timezone.utc)
    db.add(profile)
    db.commit()
    return review


@router.get("")
def get_linkedin_review(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict | None:
    profile = db.get(Profile, user.id)
    return profile.linkedin_review if profile else None


@router.post("/import")
def import_to_career(
    url: str = Form(""),
    pdf: UploadFile | None = File(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Fill the career graph from LinkedIn: positions and education. With no url/pdf, reuses the profile text
    saved by the last review. Skips entries that already exist; salaries are never on LinkedIn, so they stay empty."""
    profile = db.get(Profile, user.id) or Profile(user_id=user.id)
    if url or pdf is not None:
        url, public, text, _ = _load(url, pdf)
        _remember(profile, url, text)
        db.add(profile)
    elif profile.linkedin_text:
        public, text = None, profile.linkedin_text
    else:
        raise HTTPException(422, "Paste your LinkedIn link or upload the PDF export")

    hidden_jobs = 0
    if public:  # the public page is already structured; no LLM call needed
        jobs = [{"title": e["title"], "company": e["company"], "start": e["dates"].split(" – ")[0],
                 "end": e["dates"].split(" – ")[1]} for e in public["experience"]]
        schools = [{"school": e["school"], "degree": "", "start": e["dates"].split(" – ")[0],
                    "end": e["dates"].split(" – ")[1]} for e in public["education"]]
        # Logged-out visitors get blurred job titles ("*******") and no job dates, so those jobs can only come
        # from the PDF export; the caller asks for it when this is non-zero.
        hidden_jobs = sum(1 for j in jobs if linkedin.is_masked(j["title"]) or career.normalize_date(j["start"]) is None)
    else:
        try:
            raw = chat_json(extract.SYSTEM, text, max_tokens=2000)
        except (ValueError, openai.APIError) as e:
            raise HTTPException(502, f"Could not read the profile: {e}")
        jobs, schools = raw.get("experience") or [], raw.get("education") or []

    candidates = [(career.guess_kind(j.get("title", "")), j.get("title", ""), j.get("company", ""), j.get("start"), j.get("end"))
                  for j in jobs]
    candidates += [("education", s.get("degree") or "Student", s.get("school", ""), s.get("start"), s.get("end")) for s in schools]
    existing = {(e.kind, e.title.lower(), e.organization.lower(), e.start)
                for e in db.scalars(select(CareerEntry).where(CareerEntry.user_id == user.id))}
    added = []
    for kind, title, org, start, end in candidates:
        start, end = career.normalize_date(start), career.normalize_date(end)
        if (not title.strip() or linkedin.is_masked(title) or start is None
                or (kind, title.lower(), org.lower(), start) in existing):
            continue
        if linkedin.is_masked(org):
            org = ""
        e = CareerEntry(user_id=user.id, kind=kind, title=title.strip(), organization=org.strip(), start=start, end=end,
                        level=career.guess_level(title, kind), source="linkedin")
        db.add(e)
        added.append(e)
    db.commit()
    return {"added": len(added), "entries": [entry_out(e) for e in added], "hidden_jobs": hidden_jobs}


def _load(url: str, pdf: UploadFile | None) -> tuple[str | None, dict | None, str, str]:
    """→ (normalized url, public page data or None, profile text, source). The PDF wins when both are given."""
    try:
        url = linkedin.normalize_url(url) if url else None
        if pdf is not None:
            return url, None, linkedin.pdf_profile_text(pdf.file.read()), "pdf"
        public = linkedin.fetch_public_profile(url)
        return url, public, linkedin.public_profile_text(public), "public"
    except linkedin.LinkedInUnavailable as e:
        raise HTTPException(422, {"code": "linkedin_unavailable", "reason": e.code, "message": f"{e}."})
    except ValueError as e:
        raise HTTPException(422, str(e))


def _remember(profile: Profile, url: str | None, text: str) -> None:
    if url:
        profile.links = {**(profile.links or {}), "linkedin": url}
    profile.linkedin_text = text

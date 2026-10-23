"""No auth: a fixed set of demo accounts. The frontend shows a picker and sends X-User-Id on every request."""
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import demo_data
from .db import get_db
from .models import CareerEntry, Profile, User

# The team. Jaron is the main demo user (resume, review and two past interviews from demo_data.py);
# Manjunath starts empty so the onboarding flow can be shown.
DEMO_ACCOUNTS = [
    {"email": "jaron@demo.prepfella", "name": "Jaron D", "tagline": "Backend Engineer · Fresher",
     "target_role": "Backend Engineer", "experience_level": "Fresher"},
    {"email": "rounak@demo.prepfella", "name": "Rounak M", "tagline": "Cybersecurity Specialist · 1–2 years",
     "target_role": "Cybersecurity Specialist", "experience_level": "Junior"},
    {"email": "manjunath@demo.prepfella", "name": "Manjunath M", "tagline": "Intern · no interviews yet",
     "target_role": "", "experience_level": "Intern"},
]

# Career-graph demo data (made up). (kind, title, organization, start, end, level, salary, salary_period)
# Jaron's dip (TA after freelancing) shows the graph's "downs".
DEMO_CAREER = {
    "jaron@demo.prepfella": [
        ("education", "BCA, Computer Applications", "KLE Technological University", "2024-08", "2027-05", 0, None, "year"),
        ("internship", "Web Development Intern", "PixelCraft Studio", "2025-05", "2025-07", 1, 8000, "month"),
        ("job", "Freelance Web Developer", "Self-employed", "2025-08", "2025-12", 2, 240000, "year"),
        ("job", "Teaching Assistant", "KLE Technological University", "2026-01", "2026-04", 0, 5000, "month"),
        ("internship", "Backend Engineering Intern", "Finlytics", "2026-05", None, 1, 25000, "month"),
    ],
    "rounak@demo.prepfella": [
        ("education", "BCA, Computer Applications", "KLE Technological University", "2021-08", "2024-05", 0, None, "year"),
        ("internship", "SOC Analyst Intern", "SecureNet Labs", "2023-06", "2023-12", 1, 12000, "month"),
        ("job", "Security Analyst", "SecureNet Labs", "2024-06", "2025-03", 2, 450000, "year"),
        ("job", "Cybersecurity Specialist", "Quantiva Systems", "2025-04", None, 3, 720000, "year"),
    ],
}


def seed_demo_accounts(db: Session) -> None:
    """Create any missing demo account (with its career entries). Safe to run on every startup."""
    existing = set(db.scalars(select(User.email)))
    for a in DEMO_ACCOUNTS:
        if a["email"] in existing:
            continue
        user = User(email=a["email"], name=a["name"], tagline=a["tagline"])
        db.add(user)
        db.flush()
        db.add(Profile(user_id=user.id, target_role=a["target_role"], experience_level=a["experience_level"]))
        for kind, title, org, start, end, level, salary, period in DEMO_CAREER.get(a["email"], []):
            db.add(CareerEntry(user_id=user.id, kind=kind, title=title, organization=org, start=start, end=end,
                               level=level, salary=salary, salary_period=period))
        if a["email"] == "jaron@demo.prepfella":
            demo_data.seed_jaron(db, user.id)
    db.commit()


def current_user(x_user_id: int = Header(...), db: Session = Depends(get_db)) -> User:
    user = db.get(User, x_user_id)
    if user is None:
        raise HTTPException(401, "Unknown user; pick a demo account")
    return user


def _out(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "tagline": u.tagline}


router = APIRouter(tags=["users"])


@router.get("/users")
def list_users(db: Session = Depends(get_db)) -> list[dict]:
    """Accounts for the login picker."""
    return [_out(u) for u in db.scalars(select(User).order_by(User.id))]


@router.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    return _out(user)

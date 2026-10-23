"""Accounts. The team's accounts have no password and are picked from a list; anyone else signs up with a name and a
password and signs in with them. After that the frontend sends X-User-Id on every request (no tokens: hackathon scope)."""
import hashlib
import hmac
import secrets
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Engine, func, inspect, select, text
from sqlalchemy.orm import Session

from .db import get_db
from .models import Profile, User

# The team. Accounts start empty: everything the AI knows about a person comes from what they enter (profile, resume,
# LinkedIn, career entries, interviews), never from made-up seed data.
DEMO_ACCOUNTS = [
    {"email": "jaron@demo.prepfella", "name": "Jaron D"},
    {"email": "rounak@demo.prepfella", "name": "Rounak M"},
    {"email": "manjunath@demo.prepfella", "name": "Manjunath M"},
]
PBKDF2_ITERATIONS = 200_000
MIN_PASSWORD = 6


def migrate(engine: Engine) -> None:
    """create_all doesn't add columns to existing tables; add the ones that came later."""
    if "password_hash" not in {c["name"] for c in inspect(engine).get_columns("users")}:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(200)"))


def seed_demo_accounts(db: Session) -> None:
    """Create any missing demo account with an empty profile. Safe to run on every startup."""
    existing = set(db.scalars(select(User.email)))
    for a in DEMO_ACCOUNTS:
        if a["email"] in existing:
            continue
        user = User(email=a["email"], name=a["name"])
        db.add(user)
        db.flush()
        db.add(Profile(user_id=user.id))
    db.commit()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str | None) -> bool:
    try:
        _, iterations, salt, digest = (stored or "").split("$")
        got = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
    except ValueError:
        return False
    return hmac.compare_digest(got.hex(), digest)


def current_user(x_user_id: int = Header(...), db: Session = Depends(get_db)) -> User:
    user = db.get(User, x_user_id)
    if user is None:
        raise HTTPException(401, "Unknown user; pick a demo account")
    return user


def _out(u: User, db: Session) -> dict:
    p = db.get(Profile, u.id)
    # From what the user saved on their profile (e.g. "Backend Engineer · Fresher"); empty until they set it.
    tagline = " · ".join(x for x in (p.target_role, p.experience_level) if x) if p else ""
    return {"id": u.id, "name": u.name, "email": u.email, "tagline": tagline, "has_password": u.password_hash is not None}


def _by_name(db: Session, name: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.name) == name.lower()))


router = APIRouter(tags=["users"])


class SignUpIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(max_length=200)


class SignInIn(BaseModel):
    name: str = Field(max_length=100)
    password: str = Field(max_length=200)


@router.get("/users")
def list_users(db: Session = Depends(get_db)) -> list[dict]:
    """Every account, for the login picker. Ones with a password (has_password) ask for it before signing in."""
    return [_out(u, db) for u in db.scalars(select(User).order_by(User.id))]


@router.post("/signup")
def sign_up(body: SignUpIn, db: Session = Depends(get_db)) -> dict:
    """New account with an empty profile; the frontend then sends the user to /welcome to fill it."""
    name = " ".join(body.name.split())
    if not name:
        raise HTTPException(422, "Enter your name")
    if len(body.password) < MIN_PASSWORD:
        raise HTTPException(422, f"Use at least {MIN_PASSWORD} characters for the password")
    if _by_name(db, name):  # names are the sign-in handle, so they must be unique
        raise HTTPException(409, "That name is taken; add a surname or initial")
    user = User(email=f"{uuid.uuid4().hex[:12]}@user.prepfella", name=name, password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    db.add(Profile(user_id=user.id, links={}))
    db.commit()
    return _out(user, db)


@router.post("/signin")
def sign_in(body: SignInIn, db: Session = Depends(get_db)) -> dict:
    user = _by_name(db, " ".join(body.name.split()))
    if user is None or not check_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong name or password")
    return _out(user, db)


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    return _out(user, db)

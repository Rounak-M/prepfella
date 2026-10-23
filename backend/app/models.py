"""Tables from §3.1 of the plan. JSON columns use the portable JSON type (SQLite or Postgres)."""
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """SQLite drops the timezone; read values back as UTC so the API always sends "...+00:00"."""
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value is not None and value.tzinfo else value

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value is not None and value.tzinfo is None else value


class User(Base):
    """Team accounts have no password (picked from a list); accounts made through sign-up have one.
    Either way the frontend then sends the id as X-User-Id."""
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    tagline: Mapped[str] = mapped_column(String(200), default="")  # unused (API derives it from the profile); kept for existing DBs
    password_hash: Mapped[str | None] = mapped_column(String(200))  # "pbkdf2$<iterations>$<salt hex>$<hash hex>"; None = team account
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_now)


class Profile(Base):
    __tablename__ = "profiles"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    target_role: Mapped[str] = mapped_column(String(100), default="")
    experience_level: Mapped[str] = mapped_column(String(50), default="")
    resume_text: Mapped[str] = mapped_column(Text, default="")
    links: Mapped[dict] = mapped_column(JSON, default=dict)
    review: Mapped[dict | None] = mapped_column(JSON)
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    linkedin_text: Mapped[str] = mapped_column(Text, default="")  # URL itself lives in links["linkedin"]
    linkedin_review: Mapped[dict | None] = mapped_column(JSON)
    linkedin_reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class InterviewSession(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(100))
    level: Mapped[str] = mapped_column(String(50))
    interview_type: Mapped[str] = mapped_column(String(20))  # technical / hr / mixed
    difficulty: Mapped[str] = mapped_column(String(20))  # easy / medium / hard
    mode: Mapped[str] = mapped_column(String(10), default="text")  # voice / text
    status: Mapped[str] = mapped_column(String(20), default="active")  # active / finished
    current_difficulty: Mapped[int] = mapped_column(Integer, default=3)  # 1–5
    question_count: Mapped[int] = mapped_column(Integer, default=5)
    # Interview plan + state for the adaptive engine: {"topics": [...], "claims": [...], "probed": [...], "gaps": [...]}
    context: Mapped[dict] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_now)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    report: Mapped[dict | None] = mapped_column(JSON)


class Turn(Base):
    __tablename__ = "turns"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), index=True)
    idx: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(20), default="main")  # main / follow_up / harder / easier / resume_probe
    difficulty: Mapped[int] = mapped_column(Integer, default=3)  # 1–5 when asked
    topic: Mapped[str] = mapped_column(String(100), default="")
    question: Mapped[str] = mapped_column(Text)
    answer_text: Mapped[str | None] = mapped_column(Text)
    answer_seconds: Mapped[float | None] = mapped_column(Float)
    wpm: Mapped[float | None] = mapped_column(Float)
    filler_count: Mapped[int | None] = mapped_column(Integer)
    scores: Mapped[dict | None] = mapped_column(JSON)
    evidence: Mapped[dict | None] = mapped_column(JSON)
    feedback: Mapped[str | None] = mapped_column(Text)
    decision: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_now)


class CareerEntry(Base):
    """One point on the dashboard career graph: a job, internship or education entry."""
    __tablename__ = "career_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # job / internship / education
    title: Mapped[str] = mapped_column(String(150))  # role, or degree for education
    organization: Mapped[str] = mapped_column(String(150), default="")
    start: Mapped[str] = mapped_column(String(7))  # "YYYY" or "YYYY-MM"
    end: Mapped[str | None] = mapped_column(String(7))  # None = present
    level: Mapped[int] = mapped_column(Integer)  # seniority ladder, see career.LEVELS
    salary: Mapped[float | None] = mapped_column(Float)  # optional, in `currency`
    salary_period: Mapped[str] = mapped_column(String(5), default="year")  # month (stipend) / year (CTC)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    source: Mapped[str] = mapped_column(String(10), default="manual")  # manual / linkedin
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_now)


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    channel: Mapped[str] = mapped_column(String(10), default="coach", index=True)  # coach (Fella drawer) / advice (Advice page)
    role: Mapped[str] = mapped_column(String(10))  # user / assistant
    content: Mapped[str] = mapped_column(Text)
    quiz: Mapped[dict | None] = mapped_column(JSON)  # coach replies only: {"question", "topic"}
    resources: Mapped[list | None] = mapped_column(JSON)  # advice replies only: learning_catalog entries + YouTube searches
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_now)

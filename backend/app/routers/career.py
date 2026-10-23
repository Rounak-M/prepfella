"""Career graph entries: CRUD. LinkedIn import lives in routers/linkedin.py (POST /profile/linkedin/import)."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import career
from ..db import get_db
from ..models import CareerEntry, User
from ..users import current_user

router = APIRouter(prefix="/career", tags=["career"])

Kind = Literal["job", "internship", "education"]


class EntryIn(BaseModel):
    kind: Kind
    title: str = Field(min_length=1, max_length=150)
    organization: str = Field("", max_length=150)
    start: str
    end: str | None = None  # None = present
    level: int | None = Field(None, ge=0, le=6)  # None = guess from title
    salary: float | None = Field(None, ge=0)
    salary_period: Literal["month", "year"] = "year"
    currency: str = Field("INR", min_length=3, max_length=3)


class EntryPatch(BaseModel):
    kind: Kind | None = None
    title: str | None = Field(None, min_length=1, max_length=150)
    organization: str | None = Field(None, max_length=150)
    start: str | None = None
    end: str | None = None
    level: int | None = Field(None, ge=0, le=6)
    salary: float | None = Field(None, ge=0)
    salary_period: Literal["month", "year"] | None = None
    currency: str | None = Field(None, min_length=3, max_length=3)


def entry_out(e: CareerEntry) -> dict:
    return {
        "id": e.id, "kind": e.kind, "title": e.title, "organization": e.organization, "start": e.start, "end": e.end,
        "level": e.level, "level_label": career.LEVELS[e.level], "salary": e.salary, "salary_period": e.salary_period,
        "currency": e.currency, "salary_yearly": career.yearly_salary(e.salary, e.salary_period), "source": e.source,
    }


def _dates(start: str | None, end: str | None) -> tuple[str, str | None]:
    s = career.normalize_date(start)
    if s is None:
        raise HTTPException(422, "Start date must look like 2024 or 2024-06")
    e = career.normalize_date(end)
    if e is not None and e < s:
        raise HTTPException(422, "End date is before start date")
    return s, e


def _own(db: Session, user: User, entry_id: int) -> CareerEntry:
    e = db.get(CareerEntry, entry_id)
    if e is None or e.user_id != user.id:
        raise HTTPException(404, "No such entry")
    return e


@router.get("")
def list_entries(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(CareerEntry).where(CareerEntry.user_id == user.id).order_by(CareerEntry.start, CareerEntry.id))
    return {"levels": career.LEVELS, "entries": [entry_out(e) for e in rows]}


@router.post("")
def add_entry(body: EntryIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    start, end = _dates(body.start, body.end)
    level = body.level if body.level is not None else career.guess_level(body.title, body.kind)
    e = CareerEntry(user_id=user.id, **body.model_dump(exclude={"start", "end", "level"}), start=start, end=end, level=level)
    db.add(e)
    db.commit()
    return entry_out(e)


@router.put("/{entry_id}")
def update_entry(entry_id: int, body: EntryPatch, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    e = _own(db, user, entry_id)
    changes = body.model_dump(exclude_unset=True)
    if "start" in changes or "end" in changes:
        changes["start"], changes["end"] = _dates(changes.get("start", e.start), changes.get("end", e.end))
    for k, v in changes.items():
        setattr(e, k, v)
    db.commit()
    return entry_out(e)


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    db.delete(_own(db, user, entry_id))
    db.commit()
    return {"ok": True}

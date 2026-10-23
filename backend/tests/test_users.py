"""Sign-up / sign-in on a throwaway in-memory database. From backend/: ../.venv/Scripts/python -m pytest tests"""
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (registers tables on Base)
from app.db import Base
from app.models import Profile
from app.users import SignInIn, SignUpIn, check_password, hash_password, list_users, seed_demo_accounts, sign_in, sign_up


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        seed_demo_accounts(s)
        yield s


def test_hash_round_trip():
    h = hash_password("hunter22")
    assert check_password("hunter22", h)
    assert not check_password("hunter23", h)
    assert not check_password("anything", None)  # team accounts have no password


def test_signup_then_signin(db):
    u = sign_up(SignUpIn(name="  Asha   K ", password="secret1"), db)
    assert u["name"] == "Asha K"
    assert db.get(Profile, u["id"]) is not None
    assert sign_in(SignInIn(name="asha k", password="secret1"), db)["id"] == u["id"]
    with pytest.raises(HTTPException) as e:
        sign_in(SignInIn(name="Asha K", password="wrong!!"), db)
    assert e.value.status_code == 401
    # Shown on the picker, flagged so it asks for the password.
    assert {x["name"]: x["has_password"] for x in list_users(db)} == {"Jaron D": False, "Rounak M": False, "Manjunath M": False, "Asha K": True}


@pytest.mark.parametrize("name,password,status", [("Rounak M", "secret1", 409), ("New Person", "123", 422), ("   ", "secret1", 422)])
def test_signup_rejects(db, name, password, status):
    with pytest.raises(HTTPException) as e:
        sign_up(SignUpIn(name=name, password=password), db)
    assert e.value.status_code == status


def test_team_accounts_cannot_sign_in_with_a_password(db):
    with pytest.raises(HTTPException):
        sign_in(SignInIn(name="Rounak M", password=""), db)

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from sqlalchemy.orm import load_only
from sqlalchemy.orm.attributes import set_committed_value

from app.database import get_db
from app.core.security import decode_token
from app.models import User

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def load_user_by_id(db: Session, user_id: int) -> User | None:
    user_columns = {column["name"] for column in inspect(db.get_bind()).get_columns("users")}
    if "id" not in user_columns:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Users table is missing its id column")

    user_attributes = (
        "id",
        "email",
        "username",
        "password_hash",
        "balance",
        "discount_percent",
        "total_spent",
        "referral_discount_used",
        "referred_by",
        "is_active",
        "is_admin",
        "totp_secret",
        "token_version",
    )
    available_attributes = [
        getattr(User, attribute)
        for attribute in user_attributes
        if attribute in user_columns
    ]
    user = (
        db.query(User)
        .options(load_only(*available_attributes))
        .filter(User.id == user_id)
        .first()
    )
    if user is None:
        return None

    defaults = {
        "email": None,
        "username": None,
        "password_hash": None,
        "balance": "0",
        "discount_percent": 0,
        "total_spent": 0,
        "referral_discount_used": False,
        "referred_by": None,
        "is_active": True,
        "is_admin": False,
        "totp_secret": None,
        "token_version": 0,
        "created_at": None,
    }
    for attribute, value in defaults.items():
        if attribute not in user_columns or attribute == "created_at":
            set_committed_value(user, attribute, value)

    return user


def get_current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = load_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if payload.get("ver", 0) != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


def get_optional_current_user(
    token: str | None = Depends(oauth2_optional),
    db: Session = Depends(get_db),
) -> User | None:
    if not token:
        return None

    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user = load_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if payload.get("ver", 0) != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return user
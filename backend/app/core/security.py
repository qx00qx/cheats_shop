from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

from app.config import settings

pwd = CryptContext(schemes=["argon2", "bcrypt"], deprecated=["bcrypt"])


def hash_password(p: str) -> str:
    return pwd.hash(p)


def verify_password(p: str, h: str) -> bool:
    try:
        return pwd.verify(p, h)
    except (UnknownHashError, ValueError):
        return False


def password_needs_rehash(h: str) -> bool:
    return pwd.needs_update(h)


def create_access_token(sub: str, extra: dict | None = None) -> str:
    payload = {
        "sub": sub,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as e:
        raise ValueError(str(e))
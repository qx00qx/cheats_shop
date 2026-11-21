import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Header, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, inspect, text

from app.api.deps import load_user_by_id
from app.config import settings
from app.database import get_db
from app.models import PasswordResetToken, User
from app.core.security import (
    hash_password,
    verify_password,
    password_needs_rehash,
    create_access_token,
    decode_token,
)
from app.services.password_reset_email import send_password_reset_email
from app.services.user_discount import referral_first_purchase_available

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)
PASSWORD_RESET_TOKEN_TTL = timedelta(minutes=30)
PASSWORD_RESET_COOLDOWN = timedelta(minutes=1)
PUBLIC_SITE_HOSTS = {"millex.market", "www.millex.market"}


def _get_order_revenue(db: Session, start: datetime | None = None) -> float | None:
    inspector = inspect(db.get_bind())
    if not inspector.has_table("orders"):
        return None
    order_columns = {column["name"] for column in inspector.get_columns("orders")}
    date_filter = " AND o.created_at >= :start" if start is not None else ""
    params: dict[str, object] = {"status": "paid"}
    if start is not None:
        params["start"] = start

    if {"total", "status", "created_at"}.issubset(order_columns):
        amount_sql = "SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.status = :status"
        value = db.execute(text(amount_sql + date_filter), params).scalar_one()
        return float(value or 0)

    if {"status", "created_at", "id"}.issubset(order_columns):
        item_columns = (
            {column["name"] for column in inspector.get_columns("order_items")}
            if inspector.has_table("order_items")
            else set()
        )
        if {"order_id", "price"}.issubset(item_columns):
            value = db.execute(text("""
                SELECT COALESCE(SUM(oi.price), 0)
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE o.status = :status
            """ + date_filter), params).scalar_one()
            return float(value or 0)

    return None


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=256)
    referral_code: str | None = Field(default=None, min_length=8, max_length=32)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    password: str = Field(min_length=8, max_length=256)


def user_to_dict(user: User) -> dict:
    try:
        balance = float(user.balance or 0)
    except (TypeError, ValueError):
        balance = 0.0

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "balance": balance,
        "discount_percent": user.discount_percent,
        "total_spent": float(user.total_spent or 0),
        "referral_discount_available": referral_first_purchase_available(user),
        "is_admin": user.is_admin,
        "is_active": user.is_active,
        "created_at": _serialize_created_at(user.__dict__.get("created_at")),
    }


def _serialize_created_at(value: datetime | int | float | None) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, timezone.utc).isoformat()
    return None


def _serialize_balance(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _user_projection(columns: set[str], name: str, fallback: str) -> str:
    return name if name in columns else f"{fallback} AS {name}"


def _password_reset_base_url() -> str:
    configured_url = settings.SITE_URL.rstrip("/")
    parsed_url = urlsplit(configured_url)
    if parsed_url.hostname in PUBLIC_SITE_HOSTS:
        return "https://millex.market"
    return configured_url


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = authorization.split(" ", 1)[1]

    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user id in token",
        )

    user = load_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if payload.get("ver", 0) != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    return user


@router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    referral_code = (payload.referral_code or "").strip().upper()
    referrer = None
    if referral_code:
        referrer = db.query(User).filter(User.referral_code == referral_code).first()
        if referrer is None:
            raise HTTPException(status_code=400, detail="Invalid referral code")

    existing_user = db.query(User).filter(
        (User.email == payload.email) | (User.username == payload.username)
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),  # важно: password_hash
        balance="0",
        is_active=True,
        is_admin=False,
        referred_by=referrer.id if referrer else None,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id), {"ver": user.token_version})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_to_dict(user),
    }


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        db.commit()

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User is inactive")

    token = create_access_token(str(user.id), {"ver": user.token_version})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_to_dict(user),
    }


@router.post("/password-reset/request")
def request_password_reset(
    payload: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    email = str(payload.email).strip().casefold()
    user = db.query(User).filter(func.lower(User.email) == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь с таким email не найден.",
        )

    reset = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == user.id)
        .with_for_update()
        .first()
    )
    if reset and reset.created_at:
        created_at = reset.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if now - created_at < PASSWORD_RESET_COOLDOWN:
            return {
                "message": (
                    "На ваш email отправлена ссылка для восстановления пароля"
                )
            }

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = now + PASSWORD_RESET_TOKEN_TTL
    if reset:
        reset.token_hash = token_hash
        reset.created_at = now
        reset.expires_at = expires_at
    else:
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=token_hash,
                created_at=now,
                expires_at=expires_at,
            )
        )
    db.commit()
    reset_url = f"{_password_reset_base_url()}/reset-password?token={raw_token}"
    background_tasks.add_task(
        _deliver_password_reset_email,
        user.id,
        user.email,
        reset_url,
    )
    return {
        "message": (
            "На ваш email отправлена ссылка для восстановления пароля"
        )
    }


def _deliver_password_reset_email(user_id: int, email: str, reset_url: str) -> None:
    try:
        send_password_reset_email(to_email=email, reset_url=reset_url)
    except Exception:
        logger.exception("Failed to send password reset email for user_id=%s", user_id)


@router.post("/password-reset/confirm")
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
):
    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    reset = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .with_for_update()
        .first()
    )
    now = datetime.now(timezone.utc)
    if not reset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка недействительна или срок её действия истёк.",
        )

    expires_at = reset.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        db.delete(reset)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка недействительна или срок её действия истёк.",
        )

    user = db.query(User).filter(User.id == reset.user_id).with_for_update().first()
    if not user:
        db.delete(reset)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка недействительна или срок её действия истёк.",
        )

    user.password_hash = hash_password(payload.password)
    user.token_version += 1
    db.delete(reset)
    db.commit()
    return {"message": "Пароль успешно изменён. Войдите с новым паролем."}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return user_to_dict(current_user)


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    orders_exist = inspect(db.get_bind()).has_table("orders")
    total_users = db.execute(text("SELECT COUNT(*) FROM users")).scalar_one()
    total_orders = (
        db.execute(text("SELECT COUNT(*) FROM orders")).scalar_one()
        if orders_exist
        else 0
    )
    total_revenue = _get_order_revenue(db)

    return {
        "total_users": total_users,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
    }


@router.get("/recent-users")
def get_recent_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    user_columns = {column["name"] for column in inspect(db.get_bind()).get_columns("users")}
    fields = ", ".join((
        "id",
        _user_projection(user_columns, "email", "NULL"),
        _user_projection(user_columns, "username", "NULL"),
        _user_projection(user_columns, "balance", "0"),
        _user_projection(user_columns, "is_admin", "FALSE"),
        _user_projection(user_columns, "is_active", "TRUE"),
        _user_projection(user_columns, "created_at", "NULL"),
    ))
    order_by = "created_at DESC NULLS LAST, id DESC" if "created_at" in user_columns else "id DESC"
    rows = db.execute(text(f"""
        SELECT {fields}
        FROM users
        ORDER BY {order_by}
        LIMIT 10
    """)).mappings().all()
    return [
        {
            "id": row["id"],
            "email": row["email"],
            "username": row["username"],
            "balance": _serialize_balance(row["balance"]),
            "is_admin": row["is_admin"],
            "is_active": row["is_active"],
            "created_at": _serialize_created_at(row["created_at"]),
        }
        for row in rows
    ]


@router.get("/recent-orders")
def get_recent_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    inspector = inspect(db.get_bind())
    if not inspector.has_table("orders"):
        return []

    order_columns = {column["name"] for column in inspector.get_columns("orders")}
    required = {"id", "user_id", "status", "payment_method", "created_at"}
    if not required.issubset(order_columns):
        return []

    has_items = inspector.has_table("order_items")
    item_columns = (
        {column["name"] for column in inspector.get_columns("order_items")}
        if has_items
        else set()
    )
    item_total = (
        "COALESCE(SUM(oi.price), 0)"
        if {"order_id", "price"}.issubset(item_columns)
        else "0"
    )
    join = (
        "LEFT JOIN order_items oi ON oi.order_id = o.id"
        if item_total != "0"
        else ""
    )
    orders = db.execute(text(f"""
        SELECT o.id, o.user_id, o.status, {item_total} AS total,
               o.payment_method, o.created_at
        FROM orders o
        {join}
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 10
    """)).mappings().all()
    return [
        {
            "id": order["id"],
            "user_id": order["user_id"],
            "status": order["status"],
            "total": _serialize_balance(order["total"]),
            "payment_method": order["payment_method"],
            "created_at": order["created_at"].isoformat() if order["created_at"] else None,
        }
        for order in orders
    ]
@router.get("/users")
def list_users(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    user_columns = {column["name"] for column in inspect(db.get_bind()).get_columns("users")}
    fields = ", ".join((
        "id",
        _user_projection(user_columns, "email", "NULL"),
        _user_projection(user_columns, "username", "NULL"),
        _user_projection(user_columns, "balance", "0"),
        _user_projection(user_columns, "discount_percent", "0"),
        _user_projection(user_columns, "is_admin", "FALSE"),
        _user_projection(user_columns, "is_active", "TRUE"),
        _user_projection(user_columns, "created_at", "NULL"),
    ))
    order_by = "created_at DESC NULLS LAST, id DESC" if "created_at" in user_columns else "id DESC"
    filters = ""
    params: dict[str, object] = {"limit": limit, "offset": offset}
    if q and q.strip():
        searchable = [column for column in ("email", "username") if column in user_columns]
        if not searchable:
            raise HTTPException(status_code=400, detail="User search is unavailable")
        filters = "WHERE " + " OR ".join(f"{column} ILIKE :search" for column in searchable)
        params["search"] = f"%{q.strip()}%"
    count_params = {"search": params["search"]} if "search" in params else {}
    total = db.execute(text(f"""
        SELECT COUNT(*)
        FROM users
        {filters}
    """), count_params).scalar_one()
    rows = db.execute(text(f"""
        SELECT {fields}
        FROM users
        {filters}
        ORDER BY {order_by}
        LIMIT :limit OFFSET :offset
    """), params).mappings().all()
    items = []
    for row in rows:
        try:
            balance = float(row["balance"] or 0)
        except (TypeError, ValueError):
            balance = 0.0
        items.append({
            "id": row["id"],
            "email": row["email"],
            "username": row["username"],
            "balance": balance,
            "discount_percent": int(row["discount_percent"] or 0),
            "is_admin": row["is_admin"],
            "is_active": row["is_active"],
            "created_at": _serialize_created_at(row["created_at"]),
        })
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }

@router.get("/revenue-by-period")
def get_revenue_by_period(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    now = datetime.utcnow()

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    today_revenue = _get_order_revenue(db, today_start)
    month_revenue = _get_order_revenue(db, month_start)
    year_revenue = _get_order_revenue(db, year_start)

    return {
        "today": today_revenue,
        "month": month_revenue,
        "year": year_revenue,
    }
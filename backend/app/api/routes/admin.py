from datetime import datetime, timezone
from decimal import Decimal
import logging
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.config import settings
from app.database import get_db
from app.models import AdminPayout, BalanceAudit, User
from app.services.payouts import payouts

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)


class PayoutCreate(BaseModel):
    card_number: str = Field(..., min_length=13, max_length=19, pattern=r"^[0-9]+$")
    amount_rub: int = Field(..., ge=1, le=1_000_000)
    request_id: UUID


class UserBalanceUpdate(BaseModel):
    balance: Decimal = Field(..., ge=0, le=1000000000, max_digits=12, decimal_places=2)


class UserDiscountUpdate(BaseModel):
    discount_percent: int = Field(..., ge=0, le=10)


@router.patch("/users/{user_id}/balance")
def update_user_balance(
    user_id: int,
    payload: UserBalanceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if user is None:
        raise HTTPException(404, "User not found")

    old_balance = Decimal(str(user.balance or 0))
    new_balance = payload.balance.quantize(Decimal("0.01"))
    user.balance = format(new_balance, "f")
    db.add(BalanceAudit.for_balance_change(
        user_id=user.id,
        old_balance=old_balance,
        new_balance=new_balance,
        ctx=f"ADMIN_BALANCE_UPDATE:admin={admin.id}",
    ))
    db.commit()
    db.refresh(user)
    return {"id": user.id, "balance": float(new_balance)}


@router.patch("/users/{user_id}/discount")
def update_user_discount(
    user_id: int,
    payload: UserDiscountUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if user is None:
        raise HTTPException(404, "User not found")

    old_discount = min(10, max(0, int(user.discount_percent or 0)))
    user.discount_percent = payload.discount_percent
    db.commit()
    db.refresh(user)
    logger.info(
        "Admin updated user loyalty discount: admin_id=%s user_id=%s old=%s new=%s",
        admin.id,
        user.id,
        old_discount,
        user.discount_percent,
    )
    return {"id": user.id, "discount_percent": user.discount_percent}


def _order_rows(
    db: Session,
    table: str,
    source: str,
    columns: set[str],
    status: str | None,
    query: str | None,
    merge_limit: int,
) -> tuple[list[dict], int]:
    if table == "bot_orders":
        id_column = "external_order_id"
        aliases = {
            "id": "external_order_id",
            "status": "status",
            "total": "amount",
            "payment_method": "payment",
            "created_at": "created_at",
            "user_id": "site_user_id",
            "email": "email",
            "product": "product",
            "period": "period",
            "game": "game",
            "promo_code": None,
            "transaction_id": None,
        }
    else:
        id_column = "id"
        aliases = {
            "id": "id",
            "status": "status",
            "total": "total",
            "payment_method": "payment_method",
            "created_at": "created_at",
            "user_id": "user_id",
            "email": None,
            "product": None,
            "period": None,
            "game": None,
            "promo_code": "promo_code",
            "transaction_id": "platega_tx_id",
        }

    if not {id_column, "status"}.issubset(columns):
        return [], 0

    select_parts = [
        f"o.{aliases['id']} AS id",
        f"o.{aliases['status']} AS status",
    ]
    for output, column in aliases.items():
        if output in {"id", "status"}:
            continue
        if column and column in columns:
            select_parts.append(f"o.{column} AS {output}")
        else:
            select_parts.append(f"NULL AS {output}")

    joins = ""
    user_columns: set[str] = set()
    inspector = inspect(db.get_bind())
    if table == "orders" and "user_id" in columns and inspector.has_table("users"):
        user_columns = {item["name"] for item in inspector.get_columns("users")}
        if "id" in user_columns and "email" in user_columns:
            joins = " LEFT JOIN users u ON u.id = o.user_id"
            select_parts = [
                "u.email AS email" if part == "NULL AS email" else part
                for part in select_parts
            ]

    filters: list[str] = []
    params: dict[str, object] = {"limit": merge_limit}
    if status:
        filters.append(f"o.{aliases['status']} = :status")
        params["status"] = status
    if query:
        searchable = [f"LOWER(CAST(o.{id_column} AS TEXT)) LIKE LOWER(:query)"]
        for field in ("product", "period", "game", "email"):
            column = aliases.get(field)
            if column and column in columns:
                searchable.append(f"LOWER(CAST(o.{column} AS TEXT)) LIKE LOWER(:query)")
            elif field == "email" and joins:
                searchable.append("LOWER(u.email) LIKE LOWER(:query)")
        filters.append("(" + " OR ".join(searchable) + ")")
        params["query"] = f"%{query}%"

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    count = db.execute(
        text(f"SELECT COUNT(*) FROM {table} o{joins}{where_clause}"),
        params,
    ).scalar_one()
    rows = db.execute(
        text(
            f"SELECT {', '.join(select_parts)} FROM {table} o{joins}{where_clause} "
            f"ORDER BY o.{aliases['created_at'] if aliases['created_at'] in columns else id_column} DESC "
            "LIMIT :limit"
        ),
        params,
    ).mappings()
    return [
        {"source": source, **dict(row)}
        for row in rows
    ], int(count)


@router.get("/orders")
def list_admin_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    status: str | None = Query(default=None, max_length=32),
    q: str | None = Query(default=None, max_length=255),
    source: str = Query(default="all", pattern="^(all|store|catalog)$"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    inspector = inspect(db.get_bind())
    merge_limit = page * page_size
    orders: list[dict] = []
    total = 0

    sources = []
    if source in {"all", "store"} and inspector.has_table("orders"):
        sources.append(("orders", "store"))
    if source in {"all", "catalog"} and inspector.has_table("bot_orders"):
        sources.append(("bot_orders", "catalog"))

    for table, source_name in sources:
        columns = {column["name"] for column in inspector.get_columns(table)}
        rows, count = _order_rows(
            db,
            table,
            source_name,
            columns,
            status,
            q.strip() if q and q.strip() else None,
            merge_limit,
        )
        orders.extend(rows)
        total += count

    def order_date_key(order: dict):
        value = order.get("created_at")
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                value = None
        if value is None:
            value = datetime.min.replace(tzinfo=timezone.utc)
        elif value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value

    orders.sort(key=order_date_key, reverse=True)
    start = (page - 1) * page_size
    return {
        "items": orders[start : start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def _serialize_payout(payout: AdminPayout) -> dict:
    return {
        "id": payout.id,
        "amount_rub": int(payout.amount_rub),
        "card_last4": payout.card_last4,
        "status": payout.status,
        "provider_transaction_id": payout.provider_transaction_id,
        "provider_status": payout.provider_status,
        "error_message": payout.error_message,
        "created_at": payout.created_at,
    }


@router.get("/payouts")
def list_admin_payouts(
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    records = (
        db.query(AdminPayout)
        .order_by(AdminPayout.created_at.desc(), AdminPayout.id.desc())
        .limit(limit)
        .all()
    )
    return {"items": [_serialize_payout(record) for record in records]}


@router.post("/payouts", status_code=201)
async def create_admin_payout(
    payload: PayoutCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if not settings.PLATEGA_MERCHANT_ID or not (
        settings.PLATEGA_PAYOUT_SECRET or settings.PLATEGA_SECRET
    ):
        raise HTTPException(503, "Platega payouts are not configured")

    payout = db.query(AdminPayout).filter(
        AdminPayout.idempotency_key == str(payload.request_id)
    ).first()
    if payout:
        if payout.amount_rub != payload.amount_rub or payout.card_last4 != payload.card_number[-4:]:
            raise HTTPException(409, "Request ID is already used for a different payout")
        return _serialize_payout(payout)

    payout = AdminPayout(
        admin_user_id=admin.id,
        amount_rub=payload.amount_rub,
        card_last4=payload.card_number[-4:],
        status="processing",
        idempotency_key=str(payload.request_id),
    )
    db.add(payout)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(AdminPayout).filter(
            AdminPayout.idempotency_key == str(payload.request_id)
        ).first()
        if not existing:
            raise
        if existing.amount_rub != payload.amount_rub or existing.card_last4 != payload.card_number[-4:]:
            raise HTTPException(409, "Request ID is already used for a different payout")
        return _serialize_payout(existing)
    db.refresh(payout)

    try:
        response = await payouts.payout_card_rub(
            card_number=payload.card_number,
            amount_rub=payload.amount_rub,
            idempotency_key=payout.idempotency_key,
        )
        if not isinstance(response, dict):
            raise ValueError("Platega returned an invalid payout response")
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        ambiguous = status_code >= 500 or status_code in {408, 409, 425, 429}
        payout.status = "unknown" if ambiguous else "failed"
        payout.error_message = (
            f"Platega response is inconclusive (HTTP {status_code}); verify before retrying"
            if ambiguous
            else f"Platega rejected the payout (HTTP {status_code})"
        )
        payout.updated_at = datetime.now(timezone.utc)
        db.commit()
        if ambiguous:
            raise HTTPException(
                502,
                f"Payout status is unknown (payout #{payout.id}); verify it with Platega before retrying",
            ) from exc
        raise HTTPException(502, payout.error_message) from exc
    except (httpx.TimeoutException, httpx.TransportError, ValueError) as exc:
        payout.status = "unknown"
        payout.error_message = "Provider response is unknown; verify the payout before retrying"
        payout.updated_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            502,
            f"Payout status is unknown (payout #{payout.id}); verify it with Platega before retrying",
        ) from exc

    payout.status = "submitted"
    transaction_id = (
        response.get("transactionId")
        or response.get("payoutId")
        or response.get("id")
    )
    provider_status = response.get("status")
    payout.provider_transaction_id = str(transaction_id)[:128] if transaction_id else None
    payout.provider_status = str(provider_status)[:64] if provider_status else None
    payout.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(payout)
    return _serialize_payout(payout)

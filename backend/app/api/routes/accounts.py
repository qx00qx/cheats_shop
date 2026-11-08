import base64
import binascii
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models import BalanceAudit, BotOrder, User
from app.services.nfa import NfaConfigurationError, nfa
from app.services.user_discount import increase_user_discount
from app.services.cheat_promotion import (
    discounted_cheat_price,
    effective_cheat_discount_percent,
    get_promotion_start,
    promotion_window,
    CHEAT_PROMOTION_DISCOUNT_PERCENT,
    is_cheat_promotion_active,
)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


def _account_metadata(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _game_for_account(account_type: str, metadata: dict[str, Any]) -> tuple[str, str]:
    game = str(metadata.get("game") or "").strip()
    if game:
        return game.lower().replace(" ", "-"), game

    prefix_map = {
        "battlefield_6": ("battlefield-6", "Battlefield 6"),
        "escape_from_tarkov": ("escape-from-tarkov", "Escape from Tarkov"),
        "gta5": ("gta5", "GTA 5"),
        "cs2": ("cs2", "CS2"),
        "dayz": ("dayz", "DayZ"),
        "rust": ("rust", "Rust"),
        "valorant": ("valorant", "Valorant"),
    }
    normalized_type = account_type.lower()
    for prefix, result in prefix_map.items():
        if normalized_type == prefix or normalized_type.startswith(f"{prefix}_"):
            return result
    return "", ""


def _stock_count(metadata: dict[str, Any]) -> int:
    try:
        return max(0, int(metadata.get("stock", 0)))
    except (TypeError, ValueError):
        return 0


def _catalog_item(row: Any) -> dict[str, Any]:
    metadata = _account_metadata(row["meta_data"])
    game_key, game_name = _game_for_account(str(row["type"] or ""), metadata)
    stock = _stock_count(metadata)
    return {
        "id": int(row["id"]),
        "title": str(row["title"] or row["type"] or "Аккаунт"),
        "type": str(row["type"] or ""),
        "price": float(row["price"] or 0),
        "stock": stock,
        "in_stock": stock > 0,
        "game_key": game_key,
        "game_name": game_name,
    }


def _account_promotion_fields(db: Session) -> dict[str, Any]:
    starts_at = get_promotion_start(db)
    _, ends_at = promotion_window(starts_at)
    return {
        "promo_discount_percent": (
            CHEAT_PROMOTION_DISCOUNT_PERCENT
            if is_cheat_promotion_active(starts_at)
            else 0
        ),
        "promo_expires_at": ends_at.isoformat(),
    }


@router.get("/purchases/{order_id}/download")
def download_account_purchase(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = (
        db.query(BotOrder)
        .filter(
            BotOrder.external_order_id == order_id,
            BotOrder.site_user_id == user.id,
            BotOrder.delivery_file.is_not(None),
            BotOrder.status == "completed",
        )
        .first()
    )
    if order is None or not order.delivery_file:
        raise HTTPException(404, "Файл заказа не найден")

    filename = PurePosixPath(
        str(order.delivery_filename or "steam-account.exe").replace("\\", "/")
    ).name
    if not filename.lower().endswith(".exe"):
        filename = "steam-account.exe"
    return Response(
        content=order.delivery_file,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("")
def get_accounts(
    game: str | None = Query(default=None),
    q: str | None = Query(default=None),
    sort: str = Query(default="default"),
    db: Session = Depends(get_db),
):
    rows = db.execute(text("""
        SELECT
            id,
            name AS title,
            alias AS type,
            price,
            meta_data
        FROM accounts
        WHERE COALESCE(vis, 1) = 1
    """)).mappings().all()
    promotion_fields = _account_promotion_fields(db)
    accounts = [
        {**_catalog_item(row), **promotion_fields}
        for row in rows
    ]

    if game:
        game_filter = game.strip().lower()
        accounts = [
            account for account in accounts
            if game_filter in {
                account["game_key"].lower(),
                account["game_name"].lower(),
                account["type"].lower(),
            }
            or account["game_name"].lower().startswith(game_filter)
        ]
    if q:
        query = q.strip().lower()
        accounts = [
            account for account in accounts
            if query in account["title"].lower()
            or query in account["type"].lower()
            or query in account["game_name"].lower()
        ]

    if sort == "price_asc":
        accounts.sort(key=lambda account: (account["price"], -account["id"]))
    elif sort == "price_desc":
        accounts.sort(key=lambda account: (-account["price"], -account["id"]))
    elif sort == "stock":
        accounts.sort(key=lambda account: (-account["stock"], -account["price"]))
    else:
        accounts.sort(key=lambda account: (not account["in_stock"], account["title"].lower()))
    return accounts


@router.post("/{account_id}/purchase")
async def purchase_account(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account_row = db.execute(text("""
        SELECT id, name, alias, price, meta_data
        FROM accounts
        WHERE id = :account_id AND COALESCE(vis, 1) = 1
        FOR UPDATE
    """), {"account_id": account_id}).mappings().first()
    if not account_row:
        raise HTTPException(404, "Аккаунт не найден")

    metadata = _account_metadata(account_row["meta_data"])
    if _stock_count(metadata) <= 0:
        raise HTTPException(409, "Аккаунт закончился")

    account_type = str(account_row["alias"] or "").strip()
    if not account_type:
        raise HTTPException(409, "Для аккаунта не задан тип выдачи")

    locked_user = (
        db.query(User)
        .filter(User.id == user.id)
        .with_for_update()
        .first()
    )
    if not locked_user:
        raise HTTPException(401, "Пользователь не найден")

    discount_percent = effective_cheat_discount_percent(
        locked_user.discount_percent,
        starts_at=get_promotion_start(db),
    )
    price = discounted_cheat_price(
        Decimal(str(account_row["price"] or 0)),
        discount_percent,
    )
    old_balance = Decimal(str(locked_user.balance or 0))
    if price <= 0:
        raise HTTPException(409, "Некорректная цена аккаунта")
    if old_balance < price:
        raise HTTPException(400, "Недостаточно средств на балансе")

    try:
        delivery = await nfa.activate_direct(account_type)
    except NfaConfigurationError as exc:
        raise HTTPException(503, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(502, str(exc)) from exc
    if delivery.get("status") != "success":
        raise HTTPException(
            502,
            str(delivery.get("message") or "Поставщик не смог выдать аккаунт"),
        )

    encoded_exe = delivery.get("exe_base64")
    if not isinstance(encoded_exe, str) or not encoded_exe:
        raise HTTPException(502, "Поставщик не вернул файл аккаунта")
    if len(encoded_exe) > 35 * 1024 * 1024:
        raise HTTPException(502, "Размер файла аккаунта недопустим")
    try:
        exe_file = base64.b64decode(encoded_exe, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(502, "Поставщик вернул некорректный файл аккаунта") from exc
    if not exe_file or len(exe_file) > 25 * 1024 * 1024:
        raise HTTPException(502, "Размер файла аккаунта недопустим")
    supplied_filename = delivery.get("exe_filename")
    filename = PurePosixPath(
        str(supplied_filename or "steam-account.exe").replace("\\", "/")
    ).name
    if not filename.lower().endswith(".exe"):
        filename = "steam-account.exe"

    order_id = int(db.execute(text(
        "SELECT nextval(pg_get_serial_sequence('bot_orders', 'id'))"
    )).scalar_one())
    new_balance = old_balance - price
    cashback = (price * Decimal("0.05")).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    balance_after_payment = new_balance + cashback
    locked_user.balance = str(balance_after_payment)
    increase_user_discount(locked_user)

    db.add(BalanceAudit.for_balance_change(
        user_id=locked_user.id,
        old_balance=old_balance,
        new_balance=new_balance,
        ctx=f"ACCOUNT_ORDER #{order_id} balance",
    ))
    if cashback:
        db.add(BalanceAudit.for_balance_change(
            user_id=locked_user.id,
            old_balance=new_balance,
            new_balance=balance_after_payment,
            ctx=f"ACCOUNT_ORDER #{order_id}:CASHBACK",
        ))

    db.add(BotOrder(
        id=order_id,
        external_order_id=order_id,
        item_alias=account_type,
        payment="Баланс",
        game=str(metadata.get("game") or "") or None,
        product=str(account_row["name"] or account_type),
        period="Аккаунт",
        amount=price,
        email=locked_user.email,
        site_user_id=locked_user.id,
        status="completed",
        key_value="Файл аккаунта доступен для скачивания в истории покупок",
        delivery_file=exe_file,
        delivery_filename=filename,
    ))
    metadata["stock"] = max(0, _stock_count(metadata) - 1)
    db.execute(
        text("UPDATE accounts SET meta_data = :metadata WHERE id = :account_id"),
        {
            "metadata": json.dumps(metadata, ensure_ascii=False),
            "account_id": account_id,
        },
    )
    db.commit()
    return {
        "order_id": order_id,
        "amount": float(price),
        "delivery": None,
        "message": "Файл сохранён в заказе и доступен для скачивания из истории покупок",
        "status": "completed",
    }

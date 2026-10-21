from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ProductPlan, Order, OrderItem, User, BalanceAudit, BotOrder
from app.schemas import OrderCreate, OrderOut, OrderHistoryOut
from app.api.deps import get_current_user
from app.config import settings
from app.services.platega import platega
from app.services.order_delivery import (
    fulfill_store_order,
)
from app.services.user_discount import increase_user_discount

router = APIRouter(prefix="/api/orders", tags=["orders"])

# payment_method фронта → Platega paymentMethod
METHOD_MAP = {
    "card": 11,     # карточный эквайринг
    "sbp": 2,       # СБП / QR
    "crypto": 13,   # крипта
    "balance": 0,   # внутренний баланс
}


@router.post("", response_model=OrderOut, status_code=201)
async def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not payload.items:
        raise HTTPException(400, "Empty order")
    if payload.payment_method not in METHOD_MAP:
        raise HTTPException(400, "Unsupported payment method")
    if payload.payment_method != "balance" and (
        not settings.PLATEGA_MERCHANT_ID or not settings.PLATEGA_SECRET
    ):
        raise HTTPException(503, "Platega not configured")

    locked_user = (
        db.query(User)
        .filter(User.id == user.id)
        .with_for_update()
        .first()
    )
    discount_percent = min(10, max(0, int(locked_user.discount_percent or 0)))
    price_multiplier = (100 - discount_percent) / 100

    total = 0
    order = Order(
        user_id=user.id,
        payment_method=payload.payment_method,
        promo_code=payload.promo_code,
        status="pending",
    )
    db.add(order)
    db.flush()

    for it in payload.items:
        plan = db.get(ProductPlan, it.plan_id)
        if not plan or plan.product_id != it.product_id:
            raise HTTPException(400, f"Plan {it.plan_id} not found")
        line = round(float(plan.price) * it.qty * price_multiplier, 2)
        total += line
        db.add(OrderItem(
            order_id=order.id,
            product_id=it.product_id,
            plan_id=it.plan_id,
            qty=it.qty,
            price=line,
        ))

    order.total = total
    db.flush()

    # Оплата с баланса — списываем сразу
    if payload.payment_method == "balance":
        if float(locked_user.balance) < total:
            raise HTTPException(400, "Not enough balance")
        old = float(locked_user.balance)
        locked_user.balance = old - total
        order.status = "paid"
        order.paid_at = datetime.now(timezone.utc)
        increase_user_discount(locked_user)
        fulfill_store_order(db, order, locked_user)
        db.add(BalanceAudit.for_balance_change(
            user_id=locked_user.id,
            old_balance=old,
            new_balance=float(locked_user.balance),
            ctx=f"ORDER #{order.id} balance",
        ))
        db.commit()
        db.refresh(order)
        return order

    # Иначе создаём платёж в Platega
    pm = METHOD_MAP.get(payload.payment_method)
    db.commit()
    db.refresh(order)
    try:
        resp = await platega.create_payment(order.id, total, pm)
    except Exception as exc:
        order.status = "failed"
        db.commit()
        raise HTTPException(502, "Unable to create payment with Platega") from exc

    payment_url = resp.get("redirect") or resp.get("url")
    transaction_id = resp.get("transactionId") or resp.get("id")
    if not payment_url or not transaction_id:
        order.status = "failed"
        db.commit()
        raise HTTPException(502, "Platega returned an incomplete payment response")

    order.platega_tx_id = transaction_id
    order.platega_url = payment_url
    db.commit()
    db.refresh(order)

    return order


@router.get("", response_model=list[OrderHistoryOut])
def my_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    inspector = inspect(db.get_bind())
    regular_orders: list[dict] = []
    if inspector.has_table("orders"):
        order_columns = {column["name"] for column in inspector.get_columns("orders")}
        required_columns = {
            "id",
            "user_id",
            "status",
            "total",
            "payment_method",
            "created_at",
        }
        if required_columns.issubset(order_columns):
            optional_columns = [
                column
                for column in ("platega_url", "key_value")
                if column in order_columns
            ]
            selected_columns = [
                "id",
                "status",
                "total",
                "payment_method",
                "created_at",
                *optional_columns,
            ]
            rows = db.execute(
                text(
                    f'SELECT {", ".join(selected_columns)} '
                    'FROM orders WHERE user_id = :user_id ORDER BY created_at DESC'
                ),
                {"user_id": user.id},
            ).mappings()
            regular_orders = [dict(row) for row in rows]

    catalog_orders = db.query(
        BotOrder.external_order_id,
        BotOrder.status,
        BotOrder.amount,
        BotOrder.payment,
        BotOrder.created_at,
        BotOrder.key_value,
        BotOrder.product,
        BotOrder.period,
        BotOrder.delivery_file.is_not(None).label("delivery_file_available"),
    ).filter(
        BotOrder.site_user_id == user.id
    ).order_by(BotOrder.created_at.desc()).all()

    history = [
        {
            "id": order["id"],
            "source": "store",
            "status": order["status"],
            "total": float(order["total"] or 0),
            "payment_method": order["payment_method"],
            "created_at": order["created_at"],
            "platega_url": order.get("platega_url"),
            "key_value": order.get("key_value"),
            "product": None,
            "period": None,
            "items": [],
        }
        for order in regular_orders
    ]
    history.extend(
        {
            "id": order.external_order_id,
            "source": "catalog",
            "status": order.status,
            "total": float(order.amount or 0),
            "payment_method": order.payment or "",
            "created_at": order.created_at,
            "platega_url": None,
            "key_value": order.key_value,
            "delivery_file_available": bool(order.delivery_file_available),
            "product": order.product,
            "period": order.period,
            "items": [],
        }
        for order in catalog_orders
    )
    history.sort(key=lambda order: order["created_at"], reverse=True)
    return history
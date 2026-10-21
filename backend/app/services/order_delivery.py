from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import BotOrder, Key, Order, OrderItem, Product, ProductPlan, User


def _next_bot_order_id(db: Session) -> int:
    return int(db.execute(text(
        "SELECT nextval(pg_get_serial_sequence('bot_orders', 'id'))"
    )).scalar_one())


def _complete_store_order(order: Order) -> None:
    if not order.items or any(item.delivered_qty < item.qty for item in order.items):
        return

    now = datetime.now(timezone.utc)
    order.status = "completed"
    order.completed_at = now
    order.key_id = next((item.key_id for item in order.items if item.key_id), None)
    order.key_value = "\n\n".join(
        f"{item.key_value}" for item in order.items if item.key_value
    )


def fulfill_store_order(db: Session, order: Order, user: User) -> bool:
    now = datetime.now(timezone.utc)
    all_keys_allocated = True

    for item in order.items:
        product = db.get(Product, item.product_id)
        if product is None:
            raise HTTPException(409, f"Product {item.product_id} is missing")

        keys = (
            db.query(Key)
            .filter(Key.item_alias == product.slug, Key.status == "free")
            .order_by(Key.id)
            .with_for_update(skip_locked=True)
            .limit(item.qty)
            .all()
        )
        if len(keys) == item.qty:
            for key in keys:
                key.status = "used"
                key.used_at = now
            item.key_id = keys[0].id
            item.key_value = "\n".join(key.key_value for key in keys)
            item.delivered_qty = len(keys)
            db.flush()

        missing_keys = item.qty - (len(keys) if len(keys) == item.qty else 0)
        if missing_keys:
            all_keys_allocated = False
            plan = db.get(ProductPlan, item.plan_id)
            per_key_amount = Decimal(str(item.price)) / item.qty
            for _ in range(missing_keys):
                bot_order_id = _next_bot_order_id(db)
                db.add(BotOrder(
                    id=bot_order_id,
                    external_order_id=bot_order_id,
                    item_alias=product.slug,
                    payment=order.payment_method,
                    game=product.game.title if product.game else None,
                    product=product.title,
                    period=plan.label if plan else None,
                    amount=per_key_amount,
                    email=user.email,
                    site_user_id=user.id,
                    source_order_id=order.id,
                    source_order_item_id=item.id,
                    status="new",
                ))

    if all_keys_allocated:
        _complete_store_order(order)
    else:
        order.status = "paid_no_stock"
        order.key_id = None
        order.key_value = None
    return all_keys_allocated


def fulfill_bot_order(db: Session, order: BotOrder) -> str | None:
    key = (
        db.query(Key)
        .filter(Key.item_alias == order.item_alias, Key.status == "free")
        .order_by(Key.id)
        .with_for_update(skip_locked=True)
        .first()
    )
    if key is None:
        return None

    now = datetime.now(timezone.utc)
    key.status = "used"
    key.used_at = now
    order.key_id = key.id
    order.key_value = key.key_value
    order.status = "completed"
    order.updated_at = now
    return key.key_value


def sync_store_order_item_delivery(db: Session, bot_order: BotOrder) -> None:
    if not bot_order.source_order_id or not bot_order.source_order_item_id:
        return

    item = db.get(OrderItem, bot_order.source_order_item_id)
    if item is None or item.order_id != bot_order.source_order_id:
        return

    item.key_id = item.key_id or bot_order.key_id
    item.key_value = "\n".join(
        value
        for value in (item.key_value, bot_order.key_value)
        if value
    )
    item.delivered_qty += 1
    db.flush()

    order = db.get(Order, bot_order.source_order_id)
    if order is not None:
        _complete_store_order(order)

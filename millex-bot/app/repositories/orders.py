from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Key, Order


async def get_order_by_id(session: AsyncSession, order_id: int) -> Order | None:
    return await session.get(Order, order_id)


async def list_pending_order_notifications(
    session: AsyncSession,
    *,
    limit: int = 25,
) -> list[Order]:
    result = await session.execute(
        select(Order)
        .where(Order.status == "new", Order.notification_sent_at.is_(None))
        .order_by(Order.id)
        .limit(limit)
    )
    return list(result.scalars().all())


async def mark_order_notification_sent(session: AsyncSession, order_id: int) -> None:
    order = await session.get(Order, order_id)
    if order:
        order.notification_sent_at = datetime.now(timezone.utc)
        await session.commit()


async def list_pending_guest_payment_notifications(
    session: AsyncSession,
    *,
    limit: int = 25,
) -> list[dict]:
    result = await session.execute(
        text("""
            SELECT id, external_order_id, payment, game, product, period,
                   amount, email, platega_tx_id
            FROM bot_orders
            WHERE status = 'pending_payment'
              AND site_user_id IS NULL
              AND platega_tx_id IS NOT NULL
              AND guest_payment_notification_sent_at IS NULL
            ORDER BY id
            LIMIT :limit
            FOR UPDATE SKIP LOCKED
        """),
        {"limit": limit},
    )
    return [dict(row) for row in result.mappings()]


async def mark_guest_payment_notification_sent(
    session: AsyncSession,
    order_id: int,
) -> None:
    await session.execute(
        text("""
            UPDATE bot_orders
            SET guest_payment_notification_sent_at = now()
            WHERE id = :id AND guest_payment_notification_sent_at IS NULL
        """),
        {"id": order_id},
    )
    await session.commit()


async def list_pending_topup_notifications(
    session: AsyncSession,
    *,
    limit: int = 25,
) -> list[dict]:
    result = await session.execute(
        text("""
            SELECT b.id, b.transaction_id, b.user_id,
                   b.amount, b.currency, u.email
            FROM balance_topups AS b
            LEFT JOIN users AS u ON u.id = b.user_id
            WHERE b.status = 'confirmed'
              AND b.notification_sent_at IS NULL
            ORDER BY b.id
            LIMIT :limit
            FOR UPDATE OF b SKIP LOCKED
        """),
        {"limit": limit},
    )
    return [dict(row) for row in result.mappings()]


async def list_pending_topup_request_notifications(
    session: AsyncSession,
    *,
    limit: int = 25,
) -> list[dict]:
    result = await session.execute(
        text("""
            SELECT b.id, b.user_id, b.amount, b.currency, u.email, u.username
            FROM balance_topups AS b
            JOIN users AS u ON u.id = b.user_id
            WHERE b.request_notification_sent_at IS NULL
            ORDER BY b.id
            LIMIT :limit
            FOR UPDATE OF b SKIP LOCKED
        """),
        {"limit": limit},
    )
    return [dict(row) for row in result.mappings()]


async def mark_topup_request_notification_sent(
    session: AsyncSession,
    topup_id: int,
) -> None:
    await session.execute(
        text("""
            UPDATE balance_topups
            SET request_notification_sent_at = now()
            WHERE id = :id AND request_notification_sent_at IS NULL
        """),
        {"id": topup_id},
    )
    await session.commit()


async def mark_topup_notification_sent(
    session: AsyncSession,
    topup_id: int,
) -> None:
    await session.execute(
        text("""
            UPDATE balance_topups
            SET notification_sent_at = now()
            WHERE id = :id AND notification_sent_at IS NULL
        """),
        {"id": topup_id},
    )
    await session.commit()


async def _sync_site_order_key(
    session: AsyncSession,
    *,
    order: Order,
) -> None:
    if order.source_order_id and order.source_order_item_id:
        await session.execute(
            text("""
                UPDATE order_items
                SET key_id = COALESCE(key_id, :key_id),
                    key_value = concat_ws(E'\\n', NULLIF(key_value, ''), :key_value),
                    delivered_qty = delivered_qty + 1
                WHERE id = :item_id AND order_id = :order_id
            """),
            {
                "key_id": order.key_id,
                "key_value": order.key_value,
                "item_id": order.source_order_item_id,
                "order_id": order.source_order_id,
            },
        )
        incomplete_items = await session.scalar(
            text("""
                SELECT count(*)
                FROM order_items
                WHERE order_id = :order_id AND delivered_qty < qty
            """),
            {"order_id": order.source_order_id},
        )
        if incomplete_items == 0:
            await session.execute(
                text("""
                    UPDATE orders
                    SET status = 'completed',
                        key_id = (
                            SELECT key_id FROM order_items
                            WHERE order_id = :order_id AND key_id IS NOT NULL
                            ORDER BY id LIMIT 1
                        ),
                        key_value = (
                            SELECT string_agg(key_value, E'\\n\\n' ORDER BY id)
                            FROM order_items
                            WHERE order_id = :order_id
                        ),
                        completed_at = now()
                    WHERE id = :order_id
                """),
                {"order_id": order.source_order_id},
            )


async def attach_manual_key_to_order(
    session: AsyncSession,
    *,
    order_id: int,
    key_value: str,
    added_by_tg_id: int | None = None,
) -> Order:
    order = await session.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if not order:
        raise ValueError("ORDER_NOT_FOUND")
    if order.status != "new":
        raise ValueError("ORDER_ALREADY_PROCESSED")

    order.key_value = key_value.strip()
    order.status = "completed"
    order.updated_at = datetime.now(timezone.utc)
    await _sync_site_order_key(session, order=order)
    await session.commit()
    return order


async def assign_key_to_order(
    session: AsyncSession,
    *,
    order_id: int,
    key_id: int,
) -> Order:
    order = await session.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    key = await session.scalar(
        select(Key).where(Key.id == key_id).with_for_update()
    )
    if not order or not key:
        raise ValueError("ORDER_OR_KEY_NOT_FOUND")
    if order.status != "new" or key.status != "free":
        raise ValueError("ORDER_OR_KEY_ALREADY_PROCESSED")
    if order.item_alias != key.item_alias:
        raise ValueError("KEY_ITEM_MISMATCH")

    now = datetime.now(timezone.utc)
    key.status = "used"
    key.used_at = now
    order.key_id = key.id
    order.key_value = key.key_value
    order.status = "completed"
    order.updated_at = now

    await _sync_site_order_key(session, order=order)
    await session.commit()
    return order


async def set_order_status(
    session: AsyncSession,
    order_id: int,
    status: str,
) -> None:
    order = await session.get(Order, order_id)
    if not order:
        raise ValueError("ORDER_NOT_FOUND")
    order.status = status
    order.updated_at = datetime.now(timezone.utc)
    await session.commit()
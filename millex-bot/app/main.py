import asyncio
import logging

from sqlalchemy import text

from app.repositories.orders import (
    list_pending_guest_payment_notifications,
    list_pending_topup_notifications,
    list_pending_topup_request_notifications,
    list_pending_order_notifications,
    mark_guest_payment_notification_sent,
    mark_topup_notification_sent,
    mark_topup_request_notification_sent,
    mark_order_notification_sent,
)
from app.services.notifications import (
    notify_balance_topup,
    notify_balance_topup_request,
    notify_guest_payment_request,
    notify_new_sale,
)
from app.services.email_delivery import send_delivery_email
from app.db import SessionMaker

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram_dialog import setup_dialogs

from app.config import settings
from app.db import init_db
from app.dialogs.admin import admin_dialog, router as admin_router
from app.routers.orders import router as orders_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def order_notification_worker(bot: Bot):
    while True:
        try:
            async with SessionMaker() as session:
                guest_payment_orders = await list_pending_guest_payment_notifications(session)
                for guest_order in guest_payment_orders:
                    try:
                        sent = await notify_guest_payment_request(bot, guest_order)
                        if sent:
                            await mark_guest_payment_notification_sent(
                                session,
                                guest_order["id"],
                            )
                        else:
                            logger.error(
                                "Cannot notify admins about guest payment for order %s: no admin IDs configured",
                                guest_order["external_order_id"],
                            )
                    except Exception:
                        logger.exception(
                            "Failed to notify admins about guest payment for order %s",
                            guest_order["external_order_id"],
                        )

                orders = await list_pending_order_notifications(session)
                for order in orders:
                    try:
                        sent = await notify_new_sale(bot, order)
                        if sent:
                            await mark_order_notification_sent(session, order.id)
                    except Exception:
                        logger.exception("Failed to notify admins about order %s", order.external_order_id)
        except Exception:
            logger.exception("Order notification worker failed")

        await asyncio.sleep(5)


async def topup_notification_worker(bot: Bot):
    while True:
        try:
            async with SessionMaker() as session:
                requests = await list_pending_topup_request_notifications(session)
                for topup_request in requests:
                    try:
                        sent = await notify_balance_topup_request(bot, topup_request)
                        if sent:
                            await mark_topup_request_notification_sent(
                                session,
                                topup_request["id"],
                            )
                        else:
                            logger.error(
                                "Cannot notify admins about balance top-up request %s: no admin IDs configured",
                                topup_request["id"],
                            )
                    except Exception:
                        logger.exception(
                            "Failed to notify admins about balance top-up request %s",
                            topup_request["id"],
                        )

                topups = await list_pending_topup_notifications(session)
                for topup in topups:
                    try:
                        sent = await notify_balance_topup(bot, topup)
                        if sent:
                            await mark_topup_notification_sent(session, topup["id"])
                        else:
                            logger.error(
                                "Cannot notify admins about balance top-up %s: no admin IDs configured",
                                topup["id"],
                            )
                    except Exception:
                        logger.exception(
                            "Failed to notify admins about balance top-up %s",
                            topup["id"],
                        )
        except Exception:
            logger.exception("Balance top-up notification worker failed")

        await asyncio.sleep(5)


async def order_delivery_email_worker():
    while True:
        try:
            sent = await send_next_pending_delivery_email()
            if not sent:
                await asyncio.sleep(10)
        except Exception:
            logger.exception("Failed to send order delivery email")
            await asyncio.sleep(30)


async def send_next_pending_delivery_email() -> bool:
    async with SessionMaker() as session:
        async with session.begin():
            bot_order = (
                await session.execute(text("""
                    SELECT id, external_order_id, email, product, period, amount,
                           key_value, delivery_file, delivery_filename
                    FROM bot_orders
                    WHERE status = 'completed'
                      AND source_order_id IS NULL
                      AND email IS NOT NULL
                      AND email_sent_at IS NULL
                      AND (
                          email_next_attempt_at IS NULL
                          OR email_next_attempt_at <= now()
                      )
                      AND (key_value IS NOT NULL OR delivery_file IS NOT NULL)
                    ORDER BY id
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                """))
            ).mappings().first()

            if bot_order:
                logger.info(
                    "Attempting delivery email: order=%s smtp_configured=%s",
                    bot_order["external_order_id"],
                    bool(settings.smtp_host and settings.smtp_from_email),
                )
                try:
                    await asyncio.to_thread(
                        send_delivery_email,
                        to_email=bot_order["email"],
                        order_id=bot_order["external_order_id"],
                        product=bot_order["product"] or "цифровой товар",
                        period=bot_order["period"],
                        amount=bot_order["amount"],
                        delivery_text=(
                            "Файл аккаунта можно скачать после входа в личный кабинет "
                            "в разделе истории покупок: https://millex.market/profile/history"
                            if bot_order["delivery_file"]
                            else bot_order["key_value"]
                        ),
                        attachment=bot_order["delivery_file"],
                        attachment_name=bot_order["delivery_filename"],
                    )
                except Exception as exc:
                    logger.exception(
                        "Failed to send delivery email for order %s",
                        bot_order["external_order_id"],
                    )
                    await record_email_failure(
                        session,
                        "bot_orders",
                        bot_order["id"],
                        exc,
                    )
                    return True
                await session.execute(
                    text("""
                        UPDATE bot_orders
                        SET email_sent_at = now(),
                            email_next_attempt_at = NULL,
                            email_last_error = NULL
                        WHERE id = :id
                    """),
                    {"id": bot_order["id"]},
                )
                logger.info(
                    "Delivery email sent successfully: order=%s",
                    bot_order["external_order_id"],
                )
                return True

            store_email_schema_available = await session.scalar(text("""
                WITH required_columns(table_name, column_name) AS (
                    VALUES
                        ('orders', 'id'),
                        ('orders', 'user_id'),
                        ('orders', 'total'),
                        ('orders', 'status'),
                        ('orders', 'key_value'),
                        ('orders', 'email_sent_at'),
                        ('orders', 'email_attempts'),
                        ('orders', 'email_next_attempt_at'),
                        ('orders', 'email_last_error'),
                        ('users', 'id'),
                        ('users', 'email'),
                        ('order_items', 'id'),
                        ('order_items', 'order_id'),
                        ('order_items', 'product_id'),
                        ('order_items', 'plan_id'),
                        ('products', 'id'),
                        ('products', 'title'),
                        ('product_plans', 'id'),
                        ('product_plans', 'label')
                )
                SELECT NOT EXISTS (
                    SELECT 1
                    FROM required_columns required
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns actual
                        WHERE actual.table_schema = current_schema()
                          AND actual.table_name = required.table_name
                          AND actual.column_name = required.column_name
                    )
                )
            """))
            if not store_email_schema_available:
                return False

            store_order = (
                await session.execute(text("""
                    SELECT o.id, u.email, o.key_value, o.total,
                           COALESCE((
                               SELECT string_agg(
                                   p.title || CASE
                                       WHEN pp.label IS NOT NULL
                                       THEN ' / ' || pp.label
                                       ELSE ''
                                   END,
                                   ', ' ORDER BY oi.id
                               )
                               FROM order_items oi
                               LEFT JOIN products p ON p.id = oi.product_id
                               LEFT JOIN product_plans pp ON pp.id = oi.plan_id
                               WHERE oi.order_id = o.id
                           ), 'цифровой товар') AS product
                    FROM orders o
                    JOIN users u ON u.id = o.user_id
                    WHERE o.status = 'completed'
                      AND o.email_sent_at IS NULL
                      AND o.key_value IS NOT NULL
                      AND (
                          o.email_next_attempt_at IS NULL
                          OR o.email_next_attempt_at <= now()
                      )
                    ORDER BY o.id
                    LIMIT 1
                    FOR UPDATE OF o SKIP LOCKED
                """))
            ).mappings().first()
            if not store_order:
                return False

            try:
                logger.info(
                    "Attempting delivery email: order=%s smtp_configured=%s",
                    store_order["id"],
                    bool(settings.smtp_host and settings.smtp_from_email),
                )
                await asyncio.to_thread(
                    send_delivery_email,
                    to_email=store_order["email"],
                    order_id=store_order["id"],
                    product=store_order["product"],
                    amount=store_order["total"],
                    delivery_text=store_order["key_value"],
                )
            except Exception as exc:
                logger.exception(
                    "Failed to send delivery email for order %s",
                    store_order["id"],
                )
                await record_email_failure(
                    session,
                    "orders",
                    store_order["id"],
                    exc,
                )
                return True
            await session.execute(
                text("""
                    UPDATE orders
                    SET email_sent_at = now(),
                        email_next_attempt_at = NULL,
                        email_last_error = NULL
                    WHERE id = :id
                """),
                {"id": store_order["id"]},
            )
            logger.info(
                "Delivery email sent successfully: order=%s",
                store_order["id"],
            )
            return True


async def record_email_failure(session, table: str, order_id: int, error: Exception) -> None:
    if table not in {"orders", "bot_orders"}:
        raise ValueError("Invalid email delivery table")
    await session.execute(
        text(f"""
            UPDATE {table}
            SET email_attempts = email_attempts + 1,
                email_last_error = :error,
                email_next_attempt_at = now() + (
                    LEAST(3600, 60 * power(2, LEAST(email_attempts, 6)))
                    * interval '1 second'
                )
            WHERE id = :id
        """),
        {"id": order_id, "error": f"{type(error).__name__}: {error}"[:1000]},
    )


async def main():
    await init_db()
    logger.info(
        "Order email worker starting (SMTP host configured: %s; sender configured: %s)",
        bool(settings.smtp_host),
        bool(settings.smtp_from_email),
    )

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    dp = Dispatcher()
    dp.include_router(admin_router)
    dp.include_router(admin_dialog)
    dp.include_router(orders_router)
    setup_dialogs(dp)

    worker = asyncio.create_task(order_notification_worker(bot))
    topup_worker = asyncio.create_task(topup_notification_worker(bot))
    email_worker = asyncio.create_task(order_delivery_email_worker())
    try:
        await dp.start_polling(bot)
    finally:
        worker.cancel()
        topup_worker.cancel()
        email_worker.cancel()
        await asyncio.gather(worker, topup_worker, email_worker, return_exceptions=True)
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
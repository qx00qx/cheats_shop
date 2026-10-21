# app/services/notifications.py
from html import escape
from aiogram import Bot
from app.config import settings
from app.keyboards.order import sale_keyboard

async def notify_new_sale(bot: Bot, order):
    admin_ids = settings.admin_id_set
    if not admin_ids:
        return False

    text = (
        "🆕 <b>Новая продажа MILLEX</b>\n\n"
        f"Заказ: <b>#{order.external_order_id}</b>\n"
        f"Оплата: {escape(order.payment or '-')}\n"
        f"Игра: {escape(order.game or '-')}\n"
        f"Товар: {escape(order.product or '-')}\n"
        f"Период: {escape(order.period or '-')}\n"
        f"Сумма: {escape(str(order.amount if order.amount is not None else '-'))}\n"
        f"Email: <code>{escape(order.email or '-')}</code>\n"
        f"User ID: <code>{order.site_user_id or '-'}</code>\n\n"
        "Ключ автоматически не выдан. Выбери ключ со склада или впиши его вручную."
    )

    for admin_id in admin_ids:
        await bot.send_message(
            admin_id,
            text,
            reply_markup=sale_keyboard(order_id=order.id),
            parse_mode="HTML",
        )

    return True


async def notify_guest_payment_request(bot: Bot, order: dict) -> bool:
    admin_ids = settings.admin_id_set
    if not admin_ids:
        return False

    text = (
        "🛒 <b>Гостевая покупка — создана оплата Platega</b>\n\n"
        f"Заказ: <code>#{order['external_order_id']}</code>\n"
        f"Игра: {escape(order['game'] or '-')}\n"
        f"Товар: {escape(order['product'] or '-')}\n"
        f"Период: {escape(order['period'] or '-')}\n"
        f"Сумма: <b>{escape(str(order['amount'] if order['amount'] is not None else '-'))} RUB</b>\n"
        f"Email: <code>{escape(order['email'] or '-')}</code>\n"
        f"Способ оплаты: {escape(order['payment'] or '-')}\n"
        f"Транзакция Platega: <code>{escape(order['platega_tx_id'] or '-')}</code>\n\n"
        "Ожидается оплата. После подтверждения придёт уведомление о продаже."
    )

    for admin_id in admin_ids:
        await bot.send_message(admin_id, text, parse_mode="HTML")

    return True


async def notify_balance_topup(bot: Bot, topup: dict) -> bool:
    admin_ids = settings.admin_id_set
    if not admin_ids:
        return False

    text = (
        "💰 <b>Баланс пользователя пополнен</b>\n\n"
        f"Сумма: <b>{escape(str(topup['amount']))} {escape(topup['currency'])}</b>\n"
        f"Пользователь: <code>{escape(topup['email'] or '-')}</code>\n"
        f"User ID: <code>{topup['user_id']}</code>\n"
        f"Пополнение: <code>#{topup['id']}</code>\n"
        f"Транзакция: <code>{escape(topup['transaction_id'] or '-')}</code>"
    )

    for admin_id in admin_ids:
        await bot.send_message(admin_id, text, parse_mode="HTML")

    return True


async def notify_balance_topup_request(bot: Bot, topup: dict) -> bool:
    admin_ids = settings.admin_id_set
    if not admin_ids:
        return False

    text = (
        "📥 <b>Запрос на пополнение баланса</b>\n\n"
        f"Сумма: <b>{escape(str(topup['amount']))} {escape(topup['currency'])}</b>\n"
        f"Email: <code>{escape(topup['email'] or '-')}</code>\n"
        f"Ник: <code>{escape(topup['username'] or '-')}</code>\n"
        f"Пополнение: <code>#{topup['id']}</code>"
    )

    for admin_id in admin_ids:
        await bot.send_message(admin_id, text, parse_mode="HTML")

    return True
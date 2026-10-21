import logging

from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from app.db import SessionMaker
from app.callbacks.order import OrderCb
from app.states.order import OrderSG
from app.repositories.orders import (
    attach_manual_key_to_order,
    get_order_by_id,
    assign_key_to_order,
    set_order_status,
)
from app.repositories.promo_keys import get_free_key_by_alias

router = Router()
logger = logging.getLogger(__name__)


@router.callback_query(OrderCb.filter(F.action == "manual"))
async def on_manual_key(
    callback: CallbackQuery,
    callback_data: OrderCb,
    state: FSMContext,
):
    await callback.answer()
    logger.info(
        "Manual-key callback received: bot_order_id=%s telegram_user_id=%s",
        callback_data.order_id,
        callback.from_user.id,
    )

    try:
        async with SessionMaker() as session:
            order = await get_order_by_id(session, callback_data.order_id)
    except Exception:
        logger.exception("Failed to load bot order %s", callback_data.order_id)
        if callback.message:
            await callback.message.answer("Не удалось загрузить заказ. Проверь логи бота.")
        return

    if not order:
        if callback.message:
            await callback.message.answer("Заказ не найден в очереди бота.")
        return

    await state.update_data(order_id=callback_data.order_id)
    await state.set_state(OrderSG.wait_manual_key)

    if callback.message:
        await callback.message.answer(
            f"Отправь ключ для заказа сайта #{order.external_order_id}"
        )


@router.message(OrderSG.wait_manual_key)
async def on_manual_key_input(
    message: Message,
    state: FSMContext,
):
    key_value = (message.text or "").strip()
    if not key_value:
        await message.answer("Отправь ключ обычным текстовым сообщением.")
        return
    data = await state.get_data()
    order_id = data["order_id"]

    try:
        async with SessionMaker() as session:
            order = await attach_manual_key_to_order(
                session=session,
                order_id=order_id,
                key_value=key_value,
                added_by_tg_id=message.from_user.id,
            )
    except ValueError:
        await message.answer(
            "Не удалось выдать ключ: заказ отсутствует или уже обработан."
        )
        await state.clear()
        return
    except Exception:
        logger.exception("Failed to save key for order %s", order_id)
        await message.answer(
            "Не удалось записать ключ. Заказ не подтверждён; проверь логи бота."
        )
        return

    await message.answer(
        f"✅ Ключ для заказа сайта #{order.external_order_id} добавлен."
    )
    await state.clear()


@router.callback_query(OrderCb.filter(F.action == "stock"))
async def on_try_stock(
    callback: CallbackQuery,
    callback_data: OrderCb,
):
    async with SessionMaker() as session:
        order = await get_order_by_id(session, callback_data.order_id)
        if not order:
            await callback.message.answer("Заказ не найден.")
            await callback.answer()
            return

        key = await get_free_key_by_alias(session, order.item_alias)
        if not key:
            await callback.message.answer("Свободных ключей нет.")
            await callback.answer()
            return

        order = await assign_key_to_order(session, order_id=order.id, key_id=key.id)

    await callback.message.answer(
        f"✅ Ключ найден и привязан к заказу сайта #{order.external_order_id}\n"
        f"<code>{key.key_value}</code>",
        parse_mode="HTML"
    )
    await callback.answer()


@router.callback_query(OrderCb.filter(F.action == "reject"))
async def on_reject(
    callback: CallbackQuery,
    callback_data: OrderCb,
):
    async with SessionMaker() as session:
        await set_order_status(session, callback_data.order_id, "rejected")

    await callback.message.answer(
        f"❌ Заказ #{callback_data.order_id} отклонён."
    )
    await callback.answer()
from aiogram.utils.keyboard import InlineKeyboardBuilder
from app.callbacks.order import OrderCb

def sale_keyboard(order_id: int, order_url: str | None = None):
    kb = InlineKeyboardBuilder()

    kb.button(
        text="Вписать ключ вручную",
        callback_data=OrderCb(action="manual", order_id=order_id).pack()
    )
    kb.button(
        text="Попробовать со склада",
        callback_data=OrderCb(action="stock", order_id=order_id).pack()
    )
    kb.button(
        text="Отклонить",
        callback_data=OrderCb(action="reject", order_id=order_id).pack()
    )

    if order_url:
        kb.button(text="Открыть заказ", url=order_url)

    kb.adjust(1, 2, 1)
    return kb.as_markup()
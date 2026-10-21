from aiogram.filters.callback_data import CallbackData

class OrderCb(CallbackData, prefix="order"):
    action: str
    order_id: int
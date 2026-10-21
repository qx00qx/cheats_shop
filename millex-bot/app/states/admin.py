from aiogram.fsm.state import State, StatesGroup


class AdminSG(StatesGroup):
    menu = State()
    add_item_alias = State()
    add_key_value = State()
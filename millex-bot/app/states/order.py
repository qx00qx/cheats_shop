# app/states/order.py
from aiogram.fsm.state import StatesGroup, State

class OrderSG(StatesGroup):
    wait_manual_key = State()
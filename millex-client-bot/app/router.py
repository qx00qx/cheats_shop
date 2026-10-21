from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo


def create_router(mini_app_url: str) -> Router:
    router = Router()

    @router.message(CommandStart())
    async def start(message: Message) -> None:
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="Открыть магазин",
                        web_app=WebAppInfo(url=mini_app_url),
                    )
                ]
            ]
        )
        await message.answer(
            "Добро пожаловать в Millex.Market!",
            reply_markup=keyboard,
        )

    return router

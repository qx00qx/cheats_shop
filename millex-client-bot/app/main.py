import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession

from app.config import load_settings
from app.router import create_router


async def main() -> None:
    settings = load_settings()
    session = AiohttpSession(proxy=settings.telegram_proxy_url or None)
    bot = Bot(token=settings.bot_token, session=session)
    dispatcher = Dispatcher()
    dispatcher.include_router(create_router(settings.mini_app_url))
    try:
        await dispatcher.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())

import asyncio
import unittest
from unittest.mock import AsyncMock

from app.router import create_router


class StartCommandTests(unittest.TestCase):
    def test_start_replies_with_mini_app_button(self) -> None:
        router = create_router("https://millex.market")
        handler = router.message.handlers[0].callback
        message = AsyncMock()

        asyncio.run(handler(message))

        message.answer.assert_awaited_once()
        keyboard = message.answer.await_args.kwargs["reply_markup"]
        button = keyboard.inline_keyboard[0][0]
        self.assertEqual(button.text, "Открыть MILLEX")
        self.assertEqual(button.web_app.url, "https://millex.market")


if __name__ == "__main__":
    unittest.main()

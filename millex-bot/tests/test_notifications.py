import asyncio

from app.config import settings
from app.services.notifications import (
    notify_balance_topup,
    notify_balance_topup_request,
    notify_guest_payment_request,
)


class FakeBot:
    def __init__(self):
        self.messages = []

    async def send_message(self, chat_id, text, **kwargs):
        self.messages.append((chat_id, text, kwargs))


def test_balance_topup_notification_is_sent_to_each_admin(monkeypatch):
    monkeypatch.setattr(settings, "admin_ids", "101,202")
    bot = FakeBot()

    sent = asyncio.run(notify_balance_topup(bot, {
        "id": 7,
        "transaction_id": "tx-test",
        "user_id": 42,
        "email": "buyer@example.test",
        "amount": "500.00",
        "currency": "RUB",
    }))

    assert sent is True
    assert {message[0] for message in bot.messages} == {101, 202}
    assert all("Баланс пользователя пополнен" in message[1] for message in bot.messages)
    assert all("buyer@example.test" in message[1] for message in bot.messages)
    assert all("500.00 RUB" in message[1] for message in bot.messages)


def test_balance_topup_notification_reports_missing_admin_configuration(monkeypatch):
    monkeypatch.setattr(settings, "admin_ids", "")
    bot = FakeBot()

    sent = asyncio.run(notify_balance_topup(bot, {
        "id": 7,
        "transaction_id": "tx-test",
        "user_id": 42,
        "email": "buyer@example.test",
        "amount": "500.00",
        "currency": "RUB",
    }))

    assert sent is False
    assert bot.messages == []


def test_balance_topup_request_notification_includes_amount_email_and_username(monkeypatch):
    monkeypatch.setattr(settings, "admin_ids", "101,202")
    bot = FakeBot()

    sent = asyncio.run(notify_balance_topup_request(bot, {
        "id": 8,
        "user_id": 42,
        "email": "buyer@example.test",
        "username": "buyer-name",
        "amount": "750.00",
        "currency": "RUB",
    }))

    assert sent is True
    assert {message[0] for message in bot.messages} == {101, 202}
    assert all("Запрос на пополнение баланса" in message[1] for message in bot.messages)
    assert all("750.00 RUB" in message[1] for message in bot.messages)
    assert all("buyer@example.test" in message[1] for message in bot.messages)
    assert all("buyer-name" in message[1] for message in bot.messages)


def test_balance_topup_request_notification_escapes_html(monkeypatch):
    monkeypatch.setattr(settings, "admin_ids", "101")
    bot = FakeBot()

    asyncio.run(notify_balance_topup_request(bot, {
        "id": 8,
        "user_id": 42,
        "email": "buyer&test@example.test",
        "username": "<admin>",
        "amount": "750.00",
        "currency": "RUB",
    }))

    message = bot.messages[0][1]
    assert "buyer&amp;test@example.test" in message
    assert "&lt;admin&gt;" in message


def test_guest_payment_notification_includes_purchase_details(monkeypatch):
    monkeypatch.setattr(settings, "admin_ids", "101,202")
    bot = FakeBot()

    sent = asyncio.run(notify_guest_payment_request(bot, {
        "external_order_id": 73142,
        "game": "Game",
        "product": "Cheat",
        "period": "30 дней",
        "amount": "499.00",
        "email": "guest@example.test",
        "payment": "sbp",
        "platega_tx_id": "platega-test-transaction",
    }))

    assert sent is True
    assert {message[0] for message in bot.messages} == {101, 202}
    assert all("Гостевая покупка" in message[1] for message in bot.messages)
    assert all("#73142" in message[1] for message in bot.messages)
    assert all("499.00 RUB" in message[1] for message in bot.messages)
    assert all("guest@example.test" in message[1] for message in bot.messages)
    assert all("platega-test-transaction" in message[1] for message in bot.messages)


def test_guest_payment_notification_escapes_user_data(monkeypatch):
    monkeypatch.setattr(settings, "admin_ids", "101")
    bot = FakeBot()

    asyncio.run(notify_guest_payment_request(bot, {
        "external_order_id": 73142,
        "game": "<game>",
        "product": "Cheat & tool",
        "period": "30 дней",
        "amount": "499.00",
        "email": "guest&test@example.test",
        "payment": "sbp",
        "platega_tx_id": "<transaction>",
    }))

    message = bot.messages[0][1]
    assert "&lt;game&gt;" in message
    assert "Cheat &amp; tool" in message
    assert "guest&amp;test@example.test" in message
    assert "&lt;transaction&gt;" in message

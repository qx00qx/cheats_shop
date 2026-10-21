from app.services import email_delivery


class FakeSMTP:
    message = None

    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def starttls(self):
        pass

    def login(self, username, password):
        self.credentials = (username, password)

    def send_message(self, message):
        FakeSMTP.message = message


def test_delivery_email_attaches_provider_file(monkeypatch):
    monkeypatch.setattr(email_delivery.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(email_delivery.settings, "smtp_host", "smtp.example.test")
    monkeypatch.setattr(email_delivery.settings, "smtp_port", 587)
    monkeypatch.setattr(email_delivery.settings, "smtp_from_email", "shop@example.test")
    monkeypatch.setattr(email_delivery.settings, "smtp_use_tls", True)
    monkeypatch.setattr(email_delivery.settings, "smtp_use_ssl", False)

    email_delivery.send_delivery_email(
        to_email="buyer@example.test",
        order_id=42,
        product="Steam account",
        period="30 дней",
        amount=290,
        delivery_text=None,
        attachment=b"MZ-test",
        attachment_name="steam-account.exe",
    )

    message = FakeSMTP.message
    assert message["To"] == "buyer@example.test"
    assert message["Subject"] == "Ваш заказ MILLEX #42"
    body = message.get_body(preferencelist=("plain",)).get_content()
    assert "Заказ №42" in body
    assert "Товар / чит: Steam account" in body
    assert "Период: 30 дней" in body
    assert "Стоимость: 290.00 ₽" in body
    attachments = list(message.iter_attachments())
    assert len(attachments) == 1
    assert attachments[0].get_filename() == "steam-account.exe"
    assert attachments[0].get_content() == b"MZ-test"


def test_delivery_email_includes_purchased_cheat_key(monkeypatch):
    monkeypatch.setattr(email_delivery.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(email_delivery.settings, "smtp_host", "smtp.example.test")
    monkeypatch.setattr(email_delivery.settings, "smtp_port", 587)
    monkeypatch.setattr(email_delivery.settings, "smtp_from_email", "shop@example.test")
    monkeypatch.setattr(email_delivery.settings, "smtp_use_tls", True)
    monkeypatch.setattr(email_delivery.settings, "smtp_use_ssl", False)

    email_delivery.send_delivery_email(
        to_email="guest@example.test",
        order_id=43,
        product="Test cheat",
        period="30 дней",
        amount=100,
        delivery_text="TEST-CHEAT-KEY",
    )

    message = FakeSMTP.message
    assert message["To"] == "guest@example.test"
    body = message.get_body(preferencelist=("plain",)).get_content()
    assert "Данные для получения товара:" in body
    assert "TEST-CHEAT-KEY" in body

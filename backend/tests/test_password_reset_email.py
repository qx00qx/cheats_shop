from app.services import password_reset_email


class FakeSMTP:
    message = None

    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port
        self.timeout = timeout

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def starttls(self):
        self.tls_started = True

    def login(self, username, password):
        self.credentials = (username, password)

    def send_message(self, message):
        FakeSMTP.message = message


def test_password_reset_email_uses_configured_smtp(monkeypatch):
    monkeypatch.setattr(password_reset_email.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(password_reset_email.settings, "SMTP_HOST", "smtp.example.test")
    monkeypatch.setattr(password_reset_email.settings, "SMTP_PORT", 587)
    monkeypatch.setattr(password_reset_email.settings, "SMTP_FROM_EMAIL", "shop@example.test")
    monkeypatch.setattr(password_reset_email.settings, "SMTP_USERNAME", "smtp-user")
    monkeypatch.setattr(password_reset_email.settings, "SMTP_PASSWORD", "smtp-password")
    monkeypatch.setattr(password_reset_email.settings, "SMTP_USE_TLS", True)
    monkeypatch.setattr(password_reset_email.settings, "SMTP_USE_SSL", False)

    password_reset_email.send_password_reset_email(
        to_email="buyer@example.test",
        reset_url="https://millex.market/reset-password?token=one-time-token",
    )

    message = FakeSMTP.message
    assert message["To"] == "buyer@example.test"
    assert message["From"] == "shop@example.test"
    assert message["Subject"] == "Восстановление пароля MILLEX"
    body = message.get_content()
    assert "https://millex.market/reset-password?token=one-time-token" in body
    assert "30 минут" in body


def test_password_reset_email_requires_smtp_configuration(monkeypatch):
    monkeypatch.setattr(password_reset_email.settings, "SMTP_HOST", "")
    monkeypatch.setattr(password_reset_email.settings, "SMTP_FROM_EMAIL", "")

    try:
        password_reset_email.send_password_reset_email(
            to_email="buyer@example.test",
            reset_url="https://millex.market/reset-password?token=one-time-token",
        )
    except RuntimeError as error:
        assert "SMTP email delivery is not configured" in str(error)
    else:
        raise AssertionError("Expected missing SMTP configuration to be rejected")

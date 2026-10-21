import smtplib
from email.message import EmailMessage

from app.config import settings


def send_password_reset_email(*, to_email: str, reset_url: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        raise RuntimeError("SMTP email delivery is not configured")
    if settings.SMTP_USE_SSL and settings.SMTP_USE_TLS:
        raise RuntimeError("Configure either SMTP SSL or STARTTLS, not both")

    message = EmailMessage()
    message["Subject"] = "Восстановление пароля MILLEX"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message.set_content(
        "Здравствуйте!\n\n"
        "Чтобы задать новый пароль для аккаунта MILLEX, перейдите по ссылке:\n"
        f"{reset_url}\n\n"
        "Ссылка действительна 30 минут и может быть использована один раз. "
        "Если вы не запрашивали восстановление пароля, просто проигнорируйте письмо."
    )

    smtp_factory = smtplib.SMTP_SSL if settings.SMTP_USE_SSL else smtplib.SMTP
    with smtp_factory(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as client:
        if settings.SMTP_USE_TLS:
            client.starttls()
        if settings.SMTP_USERNAME:
            client.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        client.send_message(message)

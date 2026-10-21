import smtplib
from decimal import Decimal
from email.message import EmailMessage
from pathlib import PurePath

from app.config import settings


def send_delivery_email(
    *,
    to_email: str,
    order_id: int,
    product: str,
    period: str | None = None,
    amount: Decimal | int | float | str | None = None,
    delivery_text: str | None,
    attachment: bytes | None = None,
    attachment_name: str | None = None,
) -> None:
    if not settings.smtp_host or not settings.smtp_from_email:
        raise RuntimeError("SMTP email delivery is not configured")
    if settings.smtp_use_ssl and settings.smtp_use_tls:
        raise RuntimeError("Configure either SMTP SSL or STARTTLS, not both")

    message = EmailMessage()
    message["Subject"] = f"Ваш заказ MILLEX #{order_id}"
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    order_details = [f"Заказ №{order_id}", f"Товар / чит: {product}"]
    if period:
        order_details.append(f"Период: {period}")
    if amount is not None:
        formatted_amount = f"{Decimal(str(amount)):,.2f}".replace(",", " ")
        order_details.append(f"Стоимость: {formatted_amount} ₽")

    message_body = (
        f"Здравствуйте!\n\n"
        + "\n".join(order_details)
        + "\n\n"
        + (
            "Данные для получения товара:\n"
            f"{delivery_text}\n\n"
            if delivery_text
            else (
                "Исполняемый файл товара приложен к письму. "
                "Проверяйте его антивирусом и открывайте только если вы сами оформили этот заказ.\n\n"
            )
        )
        + "Если возникнут вопросы, обратитесь в поддержку MILLEX."
    )
    if attachment:
        message_body += (
            "\n\nИнструкция для Steam-аккаунта: полностью закройте Steam, "
            "запустите приложенный файл, нажмите Add Account и дождитесь Open Steam. "
            "После этого самостоятельно запустите Steam. Не запускайте файл на другом "
            "устройстве; для выхода используйте «Сменить пользователя», а не Sign Out."
        )
    message.set_content(message_body)

    if attachment:
        filename = PurePath(attachment_name or "delivery.exe").name
        message.add_attachment(
            attachment,
            maintype="application",
            subtype="octet-stream",
            filename=filename,
        )

    smtp_factory = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
    with smtp_factory(settings.smtp_host, settings.smtp_port, timeout=30) as client:
        if settings.smtp_use_tls:
            client.starttls()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)

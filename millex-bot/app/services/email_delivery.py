import html
import re
import smtplib
from decimal import Decimal
from email.message import EmailMessage
from pathlib import PurePath
from urllib.parse import urlsplit

from app.config import settings


def _instruction_url(value: str | None) -> str | None:
    if not value:
        return None

    parsed = urlsplit(value.strip())
    if parsed.scheme or parsed.netloc:
        if parsed.scheme not in {"http", "https"} or parsed.hostname not in {
            "millex.market",
            "www.millex.market",
            "millex.xyz",
            "www.millex.xyz",
        }:
            return None
    if parsed.query or parsed.fragment:
        return None

    path = parsed.path.rstrip("/")
    if not re.fullmatch(r"/blog/[A-Za-z0-9_-]+", path):
        return None
    return f"https://millex.market{path}"


def _key_delivery_html(
    *,
    order_id: int,
    product: str,
    period: str | None,
    formatted_amount: str | None,
    delivery_text: str,
    instruction_link: str | None,
) -> str:
    safe_product = html.escape(product)
    safe_key = html.escape(delivery_text)
    instruction_url = _instruction_url(instruction_link)
    if instruction_url:
        safe_instruction_url = html.escape(instruction_url, quote=True)
        instruction_card = f"""
                    <tr>
                        <td style="padding-bottom:30px">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                   style="background-color:#161618;border-radius:12px;border:1px solid #27272a">
                                <tr><td style="padding:20px">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td width="40" valign="middle" style="padding-right:15px">
                                                <div style="width:36px;height:36px;background-color:rgba(74,222,128,.1);
                                                            border-radius:8px;text-align:center;line-height:36px;font-size:18px">📖</div>
                                            </td>
                                            <td valign="middle">
                                                <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;
                                                          letter-spacing:1px;color:#71717a;font-weight:600">
                                                    Инструкция по использованию
                                                </p>
                                                <a href="{safe_instruction_url}"
                                                   style="font-size:16px;color:#4ade80;text-decoration:none;font-weight:500">
                                                    Открыть инструкцию для {safe_product}
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                </td></tr>
                            </table>
                        </td>
                    </tr>"""
    else:
        instruction_card = ""

    order_details = []
    if period:
        order_details.append(f"Период: {html.escape(period)}")
    if formatted_amount:
        order_details.append(f"Стоимость: {html.escape(formatted_amount)} ₽")
    details_card = ""
    if order_details:
        details_card = f"""
                    <tr>
                        <td style="padding-bottom:20px">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                   style="background-color:#161618;border-radius:12px;border:1px solid #27272a">
                                <tr><td style="padding:16px 20px;color:#a1a1aa;font-size:14px;line-height:1.7">
                                    {"<br>".join(order_details)}
                                </td></tr>
                            </table>
                        </td>
                    </tr>"""

    return f"""<!doctype html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="dark light">
    <meta name="supported-color-schemes" content="dark light">
    <title>Вы купили {safe_product}!</title>
    <style type="text/css">
        body, table, td, a {{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
        table, td {{ mso-table-lspace:0pt; mso-table-rspace:0pt; }}
        @media screen and (max-width:600px) {{
            .email-container {{ width:100% !important; max-width:100% !important; }}
            .mobile-stack {{ display:block !important; width:100% !important; padding-bottom:10px; }}
            .btn-full {{ width:100% !important; display:block !important; margin-bottom:10px !important; }}
        }}
        @media (prefers-color-scheme:dark) {{
            .dark-bg {{ background-color:#0a0a0a !important; }}
            .dark-card {{ background-color:#161618 !important; }}
        }}
    </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dark-bg">
        <tr><td align="center" valign="top" style="padding:40px 20px">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
                   class="email-container" style="max-width:600px;width:100%">
                <tr>
                    <td align="center" style="padding-bottom:30px">
                        <h1 style="margin:0;font-size:32px;font-weight:700;color:#fff;letter-spacing:-.5px">
                            Вы купили {safe_product}!
                        </h1>
                        <p style="margin:8px 0 0;font-size:16px;color:#a1a1aa">Ваш заказ успешно оформлен</p>
                        <div style="display:inline-block;margin-top:16px;padding:6px 16px;border:1px solid #27272a;
                                    border-radius:20px;background-color:#161618">
                            <span style="font-size:14px;color:#71717a;font-family:monospace"># {order_id}</span>
                        </div>
                    </td>
                </tr>
                <tr><td style="padding-bottom:20px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr><td style="border-bottom:1px solid #27272a"></td></tr>
                    </table>
                </td></tr>
                {details_card}
                <tr>
                    <td style="padding-bottom:20px">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                               class="dark-card" style="background-color:#161618;border-radius:12px;border:1px solid #27272a">
                            <tr><td style="padding:20px">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td width="55" valign="middle" style="padding-right:15px">
                                            <div style="width:36px;height:36px;background-color:rgba(74,222,128,.1);
                                                        border-radius:8px;text-align:center;line-height:36px;font-size:18px">🔑</div>
                                        </td>
                                        <td valign="middle">
                                            <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;
                                                      letter-spacing:1px;color:#71717a;font-weight:600">Ключ активации</p>
                                            <p style="margin:0;font-size:18px;font-weight:600;color:#fff;
                                                      font-family:monospace;overflow-wrap:anywhere">{safe_key}</p>
                                        </td>
                                        <td width="40" valign="middle" align="right">
                                            <div style="width:32px;height:32px;background-color:#27272a;border-radius:6px;
                                                        text-align:center;line-height:32px;font-size:14px;color:#a1a1aa">📋</div>
                                        </td>
                                    </tr>
                                </table>
                            </td></tr>
                        </table>
                    </td>
                </tr>
                {instruction_card}
                <tr>
                    <td style="padding-bottom:30px">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                               class="dark-card" style="background-color:#161618;border-radius:12px;border:1px solid #27272a">
                            <tr><td style="padding:24px">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                       style="margin-bottom:20px">
                                    <tr>
                                        <td width="55" valign="middle" style="padding-right:15px">
                                            <div style="width:36px;height:36px;background-color:rgba(59,130,246,.15);
                                                        border-radius:50%;text-align:center;line-height:36px;font-size:18px">✈️</div>
                                        </td>
                                        <td valign="middle">
                                            <h3 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#fff">
                                                Присоединяйся к сообществу
                                            </h3>
                                            <p style="margin:0;font-size:14px;color:#a1a1aa">
                                                Новости, обновления и помощь от сообщества MILLEX
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td width="32%" class="mobile-stack" style="padding-right:10px" valign="top">
                                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                                   style="background-color:#1c1c1f;border-radius:10px;border:1px solid #27272a">
                                                <tr><td align="center" style="padding:16px 10px">
                                                    <p style="margin:0;font-size:13px;font-weight:600;color:#e4e4e7">Новости проекта</p>
                                                </td></tr>
                                            </table>
                                        </td>
                                        <td width="32%" class="mobile-stack" style="padding-right:10px" valign="top">
                                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                                   style="background-color:#1c1c1f;border-radius:10px;border:1px solid #27272a">
                                                <tr><td align="center" style="padding:16px 10px">
                                                    <p style="margin:0;font-size:13px;font-weight:600;color:#e4e4e7">Обновления продуктов</p>
                                                </td></tr>
                                            </table>
                                        </td>
                                        <td width="32%" class="mobile-stack" valign="top">
                                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                                   style="background-color:#1c1c1f;border-radius:10px;border:1px solid #27272a">
                                                <tr><td align="center" style="padding:16px 10px">
                                                    <p style="margin:0;font-size:13px;font-weight:600;color:#e4e4e7">Общий чат</p>
                                                </td></tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td></tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding-bottom:30px">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                               style="background-color:#161618;border-radius:12px;border:1px solid #27272a">
                            <tr><td align="center" style="padding:20px">
                                <p style="margin:0;font-size:16px;font-weight:600;color:#fff">
                                    Остались вопросы? Обращайся в поддержку!
                                </p>
                            </td></tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td width="48%" class="btn-full" style="padding-right:2%" valign="top">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                           style="background-color:#161618;border-radius:10px;border:1px solid #27272a">
                                        <tr><td align="center" style="padding:16px">
                                            <a href="https://millex.market/profile/history"
                                               style="font-size:15px;font-weight:600;color:#a1a1aa;text-decoration:none">
                                                🕒 История покупок
                                            </a>
                                        </td></tr>
                                    </table>
                                </td>
                                <td width="48%" class="btn-full" valign="top">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                           style="background-color:rgba(74,222,128,.1);border-radius:10px;border:1px solid #4ade80">
                                        <tr><td align="center" style="padding:16px">
                                            <a href="https://millex.market"
                                               style="font-size:15px;font-weight:700;color:#4ade80;text-decoration:none">
                                                🏠 Главная
                                            </a>
                                        </td></tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr><td style="height:40px"></td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>"""


def send_delivery_email(
    *,
    to_email: str,
    order_id: int,
    product: str,
    period: str | None = None,
    amount: Decimal | int | float | str | None = None,
    delivery_text: str | None,
    instruction_link: str | None = None,
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

    if delivery_text and not attachment:
        message.add_alternative(
            _key_delivery_html(
                order_id=order_id,
                product=product,
                period=period,
                formatted_amount=(
                    formatted_amount
                    if amount is not None
                    else None
                ),
                delivery_text=delivery_text,
                instruction_link=instruction_link,
            ),
            subtype="html",
        )

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

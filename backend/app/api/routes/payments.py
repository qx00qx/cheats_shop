from datetime import datetime, timezone
import hashlib
import hmac
import logging
import secrets
from uuid import uuid4

from fastapi import APIRouter, Header, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import re
from urllib.parse import urlsplit, urlunsplit
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.config import settings
from app.models import BalanceTopUp, Order, User, BalanceAudit, BotOrder
from app.api.deps import get_current_user, get_optional_current_user
from app.services.platega import platega
from app.services.legacy_catalog import parse_legacy_tariffs
from app.services.order_delivery import (
    fulfill_bot_order,
    fulfill_store_order,
)
from app.services.accounting import (
    record_bot_order_chargeback,
    record_bot_order_sale,
    record_topup_chargeback,
    record_topup_credit,
    snapshot_order_accounting,
)
from app.services.cheat_promotion import (
    discounted_cheat_price,
    effective_cheat_discount_percent,
)
from app.services.user_discount import increase_user_discount

router = APIRouter(prefix="/api/payments", tags=["payments"])
logger = logging.getLogger(__name__)

MIN_TOPUP_AMOUNT = Decimal("50.00")
PLATEGA_CALLBACK_STATUSES = {
    "CONFIRMED",
    "CANCELED",
    "CANCELLED",
    "CHARGEBACKED",
    "CHARGEBACK",
}

METHOD_MAP = {
    "card": 11,
    "sbp": 2,
    "crypto": 13,
}

BUYER_COMMISSION_PERCENT_BY_METHOD = {
    2: Decimal("5"),
    11: Decimal("6"),
    12: Decimal("11"),
    13: Decimal("2"),
    14: Decimal("6"),
}

class PurchaseRequest(BaseModel):
    item_alias: str
    tariff_id: int
    payment_method: str = "sbp"
    email: EmailStr | None = None


class BalanceTopUpRequest(BaseModel):
    amount: Decimal = Field(
        ...,
        ge=MIN_TOPUP_AMOUNT,
        le=50000,
        max_digits=10,
        decimal_places=2,
    )
    currency: str = "RUB"
    payment_method: str = "sbp"


def purchase_cashback(amount: Decimal) -> Decimal:
    return (amount * Decimal("0.05")).quantize(Decimal("0.01"))


def _next_bot_order_id(db: Session) -> int:
    return int(db.execute(text(
        "SELECT nextval(pg_get_serial_sequence('bot_orders', 'id'))"
    )).scalar_one())


def _normalized_key(value: str) -> str:
    return "".join(character.lower() for character in value if character.isalnum())


def _public_site_url() -> str:
    site_url = settings.SITE_URL.rstrip("/")
    parsed_url = urlsplit(site_url)
    if (
        parsed_url.hostname in {"millex.market", "www.millex.market"}
        and parsed_url.port == 5173
    ):
        return urlunsplit((
            parsed_url.scheme,
            parsed_url.hostname,
            parsed_url.path.rstrip("/"),
            "",
            "",
        )).rstrip("/")
    return site_url


def _callback_value(body: dict, *keys: str):
    expected = {_normalized_key(key) for key in keys}
    queue = [body]
    while queue:
        current = queue.pop(0)
        for key, value in current.items():
            if _normalized_key(str(key)) in expected and value is not None:
                return value
        for value in current.values():
            if isinstance(value, dict):
                queue.append(value)
            elif isinstance(value, list):
                queue.extend(entry for entry in value if isinstance(entry, dict))
    return None


def _validate_callback_payment(
    body: dict,
    expected_amount: Decimal,
    expected_currency: str,
    label: str = "Payment",
    require_amount_currency: bool = False,
) -> None:
    callback_currency = _callback_value(body, "currency")
    if require_amount_currency and callback_currency is None:
        logger.warning("Rejected Platega callback: missing %s currency", label.lower())
        raise HTTPException(400, f"{label} currency is missing")
    if callback_currency and str(callback_currency).upper() != expected_currency:
        logger.warning("Rejected Platega callback: %s currency mismatch", label.lower())
        raise HTTPException(400, f"{label} currency mismatch")

    callback_amount = _callback_value(body, "amount")
    if require_amount_currency and callback_amount is None:
        logger.warning("Rejected Platega callback: missing %s amount", label.lower())
        raise HTTPException(400, f"{label} amount is missing")
    if callback_amount is not None:
        if isinstance(callback_amount, dict):
            callback_amount = _callback_value(callback_amount, "amount", "value")
        if isinstance(callback_amount, (dict, list)):
            logger.warning("Rejected Platega callback: invalid %s amount shape", label.lower())
            raise HTTPException(400, "Invalid callback amount")
        try:
            if Decimal(str(callback_amount)) != expected_amount:
                logger.warning("Rejected Platega callback: %s amount mismatch", label.lower())
                raise HTTPException(400, f"{label} amount mismatch")
        except (InvalidOperation, TypeError, ValueError):
            logger.warning("Rejected Platega callback: invalid %s amount", label.lower())
            raise HTTPException(400, "Invalid callback amount")


def _topup_payment_amounts(
    topup: BalanceTopUp,
    body: dict,
) -> set[Decimal]:
    expected_payment_amount = topup.expected_payment_amount
    if expected_payment_amount is None:
        payment_method = _callback_value(body, "paymentMethod", "payment_method")
        try:
            commission_percent = BUYER_COMMISSION_PERCENT_BY_METHOD.get(int(payment_method))
        except (TypeError, ValueError):
            commission_percent = None
        if commission_percent is None:
            expected_payment_amount = Decimal(str(topup.amount))
        else:
            expected_payment_amount = (
                Decimal(str(topup.amount))
                * (Decimal("1") + commission_percent / Decimal("100"))
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Platega may report either the merchant payment amount or the amount charged
    # to the buyer with the configured surcharge. Both represent this top-up.
    return {Decimal(str(topup.amount)), Decimal(str(expected_payment_amount))}


def _expected_buyer_payment_amount(amount: Decimal, payment_method: int) -> Decimal:
    commission_percent = BUYER_COMMISSION_PERCENT_BY_METHOD.get(payment_method)
    if commission_percent is None:
        return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return (
        amount * (Decimal("1") + commission_percent / Decimal("100"))
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _validate_topup_callback_payment(
    body: dict,
    topup: BalanceTopUp,
    status: str,
) -> None:
    normalized_status = status.upper()
    callback_currency = _callback_value(body, "currency")
    if normalized_status == "CONFIRMED" and callback_currency is None:
        logger.warning("Rejected Platega callback: missing top-up currency")
        raise HTTPException(400, "Top-up currency is missing")
    if callback_currency and str(callback_currency).upper() != topup.currency:
        logger.warning("Rejected Platega callback: top-up currency mismatch")
        raise HTTPException(400, "Top-up currency mismatch")

    callback_amount = _callback_value(body, "amount")
    if isinstance(callback_amount, dict):
        callback_amount = _callback_value(callback_amount, "amount", "value")
    if normalized_status == "CONFIRMED" and callback_amount is None:
        logger.warning("Rejected Platega callback: missing top-up amount")
        raise HTTPException(400, "Top-up amount is missing")
    if callback_amount is None:
        return
    if isinstance(callback_amount, (dict, list)):
        logger.warning("Rejected Platega callback: invalid top-up amount shape")
        raise HTTPException(400, "Invalid callback amount")

    try:
        received_amount = Decimal(str(callback_amount))
    except (InvalidOperation, TypeError, ValueError):
        logger.warning("Rejected Platega callback: invalid top-up amount")
        raise HTTPException(400, "Invalid callback amount")
    expected_amounts = _topup_payment_amounts(topup, body)
    if received_amount not in expected_amounts:
        logger.warning("Rejected Platega callback: top-up amount mismatch")
        raise HTTPException(400, "Top-up amount mismatch")


def _validate_bot_order_callback_payment(
    body: dict,
    order: BotOrder,
    status: str,
) -> None:
    payment_method_id = next(
        (method_id for slug, method_id in METHOD_MAP.items() if slug == order.payment),
        None,
    )
    callback_method = _callback_value(body, "paymentMethod", "payment_method")
    if callback_method is not None:
        try:
            callback_method_id = int(callback_method)
        except (TypeError, ValueError):
            raise HTTPException(400, "Invalid purchase payment method")
        if payment_method_id is not None and callback_method_id != payment_method_id:
            raise HTTPException(400, "Purchase payment method mismatch")
        payment_method_id = callback_method_id

    amount = Decimal(str(order.amount))
    expected_amount = order.expected_payment_amount
    if expected_amount is None and payment_method_id is not None:
        expected_amount = _expected_buyer_payment_amount(amount, payment_method_id)
    accepted_amounts = {amount}
    if expected_amount is not None:
        accepted_amounts.add(Decimal(str(expected_amount)))

    callback_currency = _callback_value(body, "currency")
    if status == "CONFIRMED" and callback_currency is None:
        raise HTTPException(400, "Purchase currency is missing")
    if callback_currency and str(callback_currency).upper() != "RUB":
        raise HTTPException(400, "Purchase currency mismatch")

    callback_amount = _callback_value(body, "amount")
    if isinstance(callback_amount, dict):
        callback_amount = _callback_value(callback_amount, "amount", "value")
    if callback_amount is None:
        if status == "CONFIRMED":
            raise HTTPException(400, "Purchase amount is missing")
        return
    if isinstance(callback_amount, (dict, list)):
        raise HTTPException(400, "Invalid callback amount")
    try:
        received_amount = Decimal(str(callback_amount))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(400, "Invalid callback amount")
    if received_amount not in accepted_amounts:
        logger.warning(
            "Rejected Platega purchase callback: amount mismatch order_id=%s",
            order.external_order_id,
        )
        raise HTTPException(400, "Purchase amount mismatch")


def _apply_balance_topup(
    db: Session,
    *,
    transaction_id: str,
    user_id: int,
    amount: Decimal,
    currency: str,
    status: str,
    body: dict,
    topup: BalanceTopUp | None = None,
) -> None:
    if currency != "RUB" or amount <= 0:
        raise HTTPException(400, "Invalid top-up transaction")
    normalized_status = status.upper()
    if topup is not None:
        _validate_topup_callback_payment(body, topup, normalized_status)
    else:
        _validate_callback_payment(
            body,
            amount,
            currency,
            "Top-up",
            require_amount_currency=normalized_status == "CONFIRMED",
        )

    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if user is None:
        raise HTTPException(404, "Top-up user not found")

    topup_ctx = f"PLATEGA_TOPUP:{transaction_id}"
    reversal_ctx = f"PLATEGA_TOPUP_REVERSAL:{transaction_id}"
    original_audit = (
        db.query(BalanceAudit)
        .filter(BalanceAudit.ctx == topup_ctx)
        .with_for_update()
        .first()
    )
    reversal_audit = (
        db.query(BalanceAudit)
        .filter(BalanceAudit.ctx == reversal_ctx)
        .with_for_update()
        .first()
    )

    if normalized_status == "CONFIRMED":
        is_chargebacked = topup is not None and topup.status == "chargebacked"
        if not is_chargebacked and not reversal_audit and original_audit is None:
            old_balance = Decimal(str(user.balance or 0))
            new_balance = old_balance + amount
            user.balance = str(new_balance)
            db.add(BalanceAudit.for_balance_change(
                user_id=user.id,
                old_balance=old_balance,
                new_balance=new_balance,
                ctx=topup_ctx,
            ))
        if topup and topup.status != "chargebacked":
            topup.status = "confirmed"
        if not is_chargebacked:
            record_topup_credit(
                db,
                origin_key=f"platega-topup:{transaction_id}",
                amount=amount,
            )
    elif normalized_status in {"CANCELED", "CANCELLED"}:
        if topup and topup.status == "pending":
            topup.status = "failed"
    elif normalized_status in {"CHARGEBACK", "CHARGEBACKED"}:
        if original_audit and reversal_audit is None:
            credited_amount = (
                Decimal(str(original_audit.new_balance))
                - Decimal(str(original_audit.old_balance))
            )
            old_balance = Decimal(str(user.balance or 0))
            new_balance = old_balance - credited_amount
            user.balance = str(new_balance)
            db.add(BalanceAudit.for_balance_change(
                user_id=user.id,
                old_balance=old_balance,
                new_balance=new_balance,
                ctx=reversal_ctx,
            ))
        if topup:
            topup.status = "chargebacked"
        if original_audit is not None:
            credited_amount = (
                Decimal(str(original_audit.new_balance))
                - Decimal(str(original_audit.old_balance))
            )
            if credited_amount > 0:
                record_topup_chargeback(
                    db,
                    origin_key=f"platega-topup-chargeback:{transaction_id}",
                    amount=credited_amount,
                )

    if topup:
        topup.updated_at = datetime.now(timezone.utc)
    db.commit()


def _mark_topup_failed_if_pending(db: Session, topup_id: int) -> None:
    topup = (
        db.query(BalanceTopUp)
        .filter(BalanceTopUp.id == topup_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if topup and topup.status == "pending":
        topup.status = "failed"
        topup.updated_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/topup")
async def create_balance_topup(
    payload: BalanceTopUpRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not settings.PLATEGA_MERCHANT_ID or not settings.PLATEGA_SECRET:
        raise HTTPException(503, "Platega not configured")

    method_slug = payload.payment_method.lower()
    method = METHOD_MAP.get(method_slug)
    if method is None:
        raise HTTPException(400, "Unsupported payment method")

    amount = payload.amount.quantize(Decimal("0.01"))
    currency = payload.currency.upper()
    if currency != "RUB":
        raise HTTPException(400, "Пополнить баланс можно только в RUB")
    if amount < MIN_TOPUP_AMOUNT:
        raise HTTPException(400, "Минимальная сумма пополнения баланса 50 RUB")

    commission_percent = BUYER_COMMISSION_PERCENT_BY_METHOD[method]
    expected_payment_amount = (
        amount * (Decimal("1") + commission_percent / Decimal("100"))
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    reference = uuid4().hex
    topup = BalanceTopUp(
        reference=reference,
        user_id=user.id,
        amount=amount,
        expected_payment_amount=expected_payment_amount,
        currency=currency,
        status="pending",
    )
    db.add(topup)
    db.commit()

    custom_payload = f"balance:{user.id}:{currency}:{amount:f}:{reference}"
    try:
        resp = await platega.create_payment(
            order_id=1000000 + user.id,
            amount=float(amount),
            method=method,
            description=f"Пополнение баланса #{user.id}",
            currency=currency,
            payload=custom_payload,
            return_url=(
                f"{_public_site_url()}/payment/success"
                f"?type=topup&reference={reference}"
            ),
            failed_url=(
                f"{_public_site_url()}/profile/balance"
                f"?payment=failed&reference={reference}"
            ),
        )
    except Exception as exc:  # pragma: no cover - external API call
        _mark_topup_failed_if_pending(db, topup.id)
        raise HTTPException(502, f"Platega error: {exc}") from exc

    payment_url = _callback_value(resp, "redirect", "url")
    transaction_id = _callback_value(
        resp,
        "transactionId",
        "transaction_id",
        "id",
    )
    if not payment_url or not transaction_id:
        _mark_topup_failed_if_pending(db, topup.id)
        raise HTTPException(502, "Platega returned an incomplete payment response")

    transaction_id = str(transaction_id)
    existing_topup = (
        db.query(BalanceTopUp)
        .filter(
            BalanceTopUp.transaction_id == transaction_id,
            BalanceTopUp.id != topup.id,
        )
        .first()
    )
    if existing_topup:
        _mark_topup_failed_if_pending(db, topup.id)
        raise HTTPException(502, "Platega returned a duplicate transaction id")
    topup.transaction_id = transaction_id
    topup.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "transaction_id": transaction_id,
        "reference": reference,
        "payment_url": payment_url,
        "amount": float(amount),
        "expected_payment_amount": float(expected_payment_amount),
        "currency": currency,
    }


@router.get("/topup/latest")
async def get_latest_balance_topup(
    reference: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(BalanceTopUp).filter(BalanceTopUp.user_id == user.id)
    if reference:
        query = query.filter(BalanceTopUp.reference == reference)
    topup = query.order_by(BalanceTopUp.created_at.desc(), BalanceTopUp.id.desc()).first()
    if topup is None:
        raise HTTPException(404, "No balance top-up found")

    if topup.status == "pending" and topup.transaction_id:
        if not settings.PLATEGA_MERCHANT_ID or not settings.PLATEGA_SECRET:
            raise HTTPException(503, "Platega not configured")
        try:
            provider_status = await platega.get_transaction_status(topup.transaction_id)
        except RuntimeError as exc:
            logger.warning(
                "Failed to check Platega top-up status: transaction_id=%s error=%s",
                topup.transaction_id,
                exc,
            )
            raise HTTPException(502, "Unable to check payment status with Platega") from exc

        provider_transaction_id = str(
            _callback_value(provider_status, "id", "transactionId", "transaction_id") or ""
        ).strip()
        if provider_transaction_id != topup.transaction_id:
            logger.warning(
                "Platega status transaction id mismatch: expected=%s received=%s",
                topup.transaction_id,
                provider_transaction_id,
            )
            raise HTTPException(502, "Platega returned a different transaction")

        provider_payment_status = str(
            _callback_value(provider_status, "status", "paymentStatus") or ""
        ).upper().strip()
        if provider_payment_status not in PLATEGA_CALLBACK_STATUSES | {"PENDING"}:
            logger.warning(
                "Platega returned unsupported top-up status: transaction_id=%s status=%s",
                topup.transaction_id,
                provider_payment_status,
            )
            raise HTTPException(502, "Platega returned an unsupported payment status")

        _apply_balance_topup(
            db,
            transaction_id=topup.transaction_id,
            user_id=topup.user_id,
            amount=Decimal(str(topup.amount)),
            currency=topup.currency,
            status=provider_payment_status,
            body=provider_status,
            topup=topup,
        )

    return {
        "transaction_id": topup.transaction_id,
        "amount": float(topup.amount),
        "currency": topup.currency,
        "status": topup.status,
    }


@router.post("/webhook")
async def platega_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    if not raw_body:
        logger.warning("Rejected empty Platega callback")
        raise HTTPException(400, "Empty webhook body")

    if not settings.PLATEGA_MERCHANT_ID or not settings.PLATEGA_SECRET:
        logger.error("Rejected Platega callback: credentials are not configured")
        raise HTTPException(503, "Platega webhook is not configured")

    merchant_id = request.headers.get("X-MerchantId")
    secret = request.headers.get("X-Secret")

    if merchant_id != settings.PLATEGA_MERCHANT_ID:
        logger.warning("Rejected Platega callback: merchant id mismatch")
        raise HTTPException(403, "Invalid merchant id")
    if not secret or not hmac.compare_digest(secret, settings.PLATEGA_SECRET):
        logger.warning("Rejected Platega callback: secret mismatch")
        raise HTTPException(403, "Invalid secret")

    try:
        body = await request.json()
    except ValueError:
        logger.warning("Rejected Platega callback: invalid JSON")
        raise HTTPException(400, "Invalid webhook JSON")

    if not isinstance(body, dict):
        logger.warning("Rejected Platega callback: JSON body is not an object")
        raise HTTPException(400, "Invalid webhook body")

    tx_value = _callback_value(
        body,
        "id",
        "transactionId",
        "transaction_id",
        "paymentId",
        "payment_id",
    )
    tx_id = str(tx_value or "").strip()
    status = str(_callback_value(body, "status", "paymentStatus") or "").upper().strip()
    custom_payload = str(_callback_value(body, "payload", "customPayload") or "")

    if not tx_id or not status:
        logger.warning("Rejected Platega callback: missing transaction id or status")
        raise HTTPException(400, "Webhook is missing transaction id or status")
    if status not in PLATEGA_CALLBACK_STATUSES:
        logger.warning(
            "Rejected Platega callback: unsupported status transaction_id=%s status=%s",
            tx_id,
            status,
        )
        raise HTTPException(400, "Unsupported webhook status")

    logger.info(
        "Processing Platega callback: transaction_id=%s status=%s",
        tx_id,
        status,
    )

    topup_query = db.query(BalanceTopUp).filter(
        BalanceTopUp.transaction_id == tx_id
    )
    topup = topup_query.with_for_update().first()
    if topup is None and custom_payload.startswith("balance:"):
        payload_parts = custom_payload.split(":", 4)
        if len(payload_parts) == 5 and payload_parts[4]:
            topup = (
                db.query(BalanceTopUp)
                .filter(BalanceTopUp.reference == payload_parts[4])
                .with_for_update()
                .first()
            )
    if topup:
        if topup.transaction_id is None:
            topup.transaction_id = tx_id
        if custom_payload.startswith("balance:"):
            payload_parts = custom_payload.split(":", 4)
            if len(payload_parts) != 5 or not payload_parts[4]:
                raise HTTPException(400, "Invalid top-up payload")
            try:
                payload_user_id = int(payload_parts[1])
                payload_amount = Decimal(payload_parts[3])
            except (ValueError, InvalidOperation):
                raise HTTPException(400, "Invalid top-up payload")
            if (
                payload_user_id != topup.user_id
                or payload_parts[2].upper() != topup.currency
                or payload_amount != Decimal(str(topup.amount))
                or payload_parts[4] != topup.reference
            ):
                raise HTTPException(400, "Top-up payload mismatch")
        _apply_balance_topup(
            db,
            transaction_id=tx_id,
            user_id=topup.user_id,
            amount=Decimal(str(topup.amount)),
            currency=topup.currency,
            status=status,
            body=body,
            topup=topup,
        )
        logger.info(
            "Acknowledged Platega top-up callback: transaction_id=%s status=%s",
            tx_id,
            status,
        )
        return {"ok": True}

    if custom_payload.startswith("balance:"):
        try:
            payload_parts = custom_payload.split(":", 4)
            _, _, _, _, reference = payload_parts
        except ValueError:
            raise HTTPException(400, "Invalid top-up payload")
        if reference:
            logger.warning(
                "Platega top-up callback has no matching reference: transaction_id=%s",
                tx_id,
            )
            raise HTTPException(404, "Top-up payment reference not found")
        raise HTTPException(400, "Invalid top-up payload")

    bot_order = None
    if custom_payload.startswith("bot_purchase:"):
        try:
            external_order_id = int(custom_payload.split(":", 1)[1])
        except (ValueError, IndexError):
            raise HTTPException(400, "Invalid purchase payload")

        bot_order = (
            db.query(BotOrder)
            .filter(BotOrder.external_order_id == external_order_id)
            .with_for_update()
            .first()
        )
    else:
        bot_order = (
            db.query(BotOrder)
            .filter(BotOrder.platega_tx_id == tx_id)
            .with_for_update()
            .first()
        )

    if bot_order:
        _validate_bot_order_callback_payment(body, bot_order, status)

        if status == "CONFIRMED" and bot_order.status == "pending_payment":
            bot_order.status = "new"
            if bot_order.site_user_id is not None:
                account = (
                    db.query(User)
                    .filter(User.id == bot_order.site_user_id)
                    .with_for_update()
                    .first()
                )
                cashback_ctx = (
                    f"CATALOG_ORDER:{bot_order.external_order_id}:CASHBACK"
                )
                cashback_exists = db.query(BalanceAudit.id).filter(
                    BalanceAudit.ctx == cashback_ctx
                ).first()
                if account and not cashback_exists:
                    cashback = purchase_cashback(Decimal(str(bot_order.amount)))
                    if cashback > 0:
                        old_balance = Decimal(str(account.balance or 0))
                        new_balance = old_balance + cashback
                        account.balance = str(new_balance)
                        db.add(BalanceAudit.for_balance_change(
                            user_id=account.id,
                            old_balance=old_balance,
                            new_balance=new_balance,
                            ctx=cashback_ctx,
                        ))
                if account:
                    increase_user_discount(account)
            fulfill_bot_order(db, bot_order)
            record_bot_order_sale(db, bot_order)
        elif status in {"CANCELED", "CANCELLED"} and bot_order.status == "pending_payment":
            bot_order.status = "failed"
        elif status in {"CHARGEBACK", "CHARGEBACKED"}:
            bot_order.status = "chargeback"
            record_bot_order_chargeback(db, bot_order)

        db.commit()
        logger.info(
            "Acknowledged Platega bot-order callback: transaction_id=%s status=%s",
            tx_id,
            status,
        )
        return {"ok": True}

    # -------------------------------------------------
    # 2) Оплата заказа на товар
    # -------------------------------------------------
    order = (
        db.query(Order)
        .filter(Order.platega_tx_id == tx_id)
        .with_for_update()
        .first()
    )

    if not order:
        logger.warning(
            "Platega callback has no matching payment: transaction_id=%s status=%s",
            tx_id,
            status,
        )
        raise HTTPException(404, "Payment transaction not found")

    _validate_callback_payment(
        body,
        Decimal(str(order.total)),
        "RUB",
        "Order",
    )

    if status in {"CANCELED", "CANCELLED"}:
        order.status = "failed"
        db.commit()
        logger.info("Acknowledged Platega order callback: transaction_id=%s status=%s", tx_id, status)
        return {"ok": True}

    if status in {"CHARGEBACK", "CHARGEBACKED"}:
        order.status = "chargeback"
        db.commit()
        logger.info("Acknowledged Platega order callback: transaction_id=%s status=%s", tx_id, status)
        return {"ok": True}

    if order.status in {"paid", "completed", "paid_no_stock"}:
        db.commit()
        logger.info("Acknowledged duplicate Platega confirmation: transaction_id=%s", tx_id)
        return {"ok": True}

    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc)
    account = (
        db.query(User)
        .filter(User.id == order.user_id)
        .with_for_update()
        .first()
    )
    if account:
        increase_user_discount(account)
    if account is None:
        order.status = "paid_no_stock"
    else:
        fulfill_store_order(db, order, account)
    db.commit()
    logger.info("Acknowledged Platega order callback: transaction_id=%s status=%s", tx_id, status)
    return {"ok": True}

@router.post("/buy")
async def create_item_purchase(
    payload: PurchaseRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
):
    method_slug = payload.payment_method.lower()
    method = METHOD_MAP.get(method_slug)
    if method_slug == "balance" and user is None:
        raise HTTPException(401, "Sign in to pay with your balance")
    if method_slug != "balance" and method is None:
        raise HTTPException(400, "Unsupported payment method")
    if user is None and payload.email is None:
        raise HTTPException(422, "Email is required for guest checkout")
    if method_slug != "balance" and (
        not settings.PLATEGA_MERCHANT_ID or not settings.PLATEGA_SECRET
    ):
        raise HTTPException(503, "Platega not configured")

    item = db.execute(text("""
        SELECT id, name, alias, "categoryData", tabs, prices
        FROM items
        WHERE alias = :alias AND status = 1
        LIMIT 1
    """), {"alias": payload.item_alias}).mappings().first()

    if not item:
        raise HTTPException(404, "Item not found")

    tariffs = parse_legacy_tariffs(item["tabs"], item["prices"])
    tariff = next((entry for entry in tariffs if entry["id"] == payload.tariff_id), None)

    if not tariff:
        raise HTTPException(404, "Tariff not found")

    locked_user = (
        db.query(User)
        .filter(User.id == user.id)
        .with_for_update()
        .first()
    ) if user else None

    external_order_id = _next_bot_order_id(db)
    return_token = secrets.token_urlsafe(32)
    return_token_hash = hashlib.sha256(return_token.encode("utf-8")).hexdigest()
    category_match = re.search(r'"id"\s*:\s*([0-9]+)', item["categoryData"] or "")
    game = None
    if category_match:
        game = db.execute(text(
            "SELECT name FROM categories WHERE id = :category_id"
        ), {"category_id": int(category_match.group(1))}).scalar_one_or_none()

    discount_percent = effective_cheat_discount_percent(
        locked_user.discount_percent if locked_user else 0,
    )
    amount = discounted_cheat_price(
        Decimal(str(tariff["price"])),
        discount_percent,
    )
    expected_payment_amount = (
        _expected_buyer_payment_amount(amount, method)
        if method_slug != "balance"
        else amount
    )
    if method_slug == "balance":
        if locked_user is None:
            raise HTTPException(401, "Sign in to pay with your balance")
        old_balance = Decimal(str(locked_user.balance or 0))
        if old_balance < amount:
            raise HTTPException(400, "Insufficient balance")

        debited_balance = old_balance - amount
        cashback = purchase_cashback(amount)
        new_balance = debited_balance + cashback
        locked_user.balance = str(new_balance)
        increase_user_discount(locked_user)
        db.add(BalanceAudit.for_balance_change(
            user_id=locked_user.id,
            old_balance=old_balance,
            new_balance=debited_balance,
            ctx=f"CATALOG_ORDER #{external_order_id} balance",
        ))
        db.add(BalanceAudit.for_balance_change(
            user_id=locked_user.id,
            old_balance=debited_balance,
            new_balance=new_balance,
            ctx=f"CATALOG_ORDER #{external_order_id}:CASHBACK",
        ))
        bot_order = BotOrder(
            id=external_order_id,
            external_order_id=external_order_id,
            item_alias=item["alias"],
            return_token_hash=return_token_hash,
            payment="Баланс",
            game=game,
            product=item["name"],
            period=tariff["title"],
            amount=amount,
            email=locked_user.email,
            site_user_id=locked_user.id,
            status="new",
            **snapshot_order_accounting(
                db,
                item_id=item["id"],
                tariff_id=tariff["id"],
            ),
        )
        db.add(bot_order)
        db.flush()
        record_bot_order_sale(db, bot_order)
        db.commit()
        return {
            "order_id": external_order_id,
            "status": bot_order.status,
            "amount": float(amount),
            "currency": "RUB",
            "delivery": None,
            "delivery_url": (
                f"/purchase/delivery?order_id={external_order_id}"
                f"&token={return_token}"
            ),
        }

    db.add(BotOrder(
        id=external_order_id,
        external_order_id=external_order_id,
        item_alias=item["alias"],
        return_token_hash=return_token_hash,
        payment=method_slug,
        game=game,
        product=item["name"],
        period=tariff["title"],
        amount=amount,
        expected_payment_amount=expected_payment_amount,
        email=user.email if user else str(payload.email),
        site_user_id=user.id if user else None,
        status="pending_payment",
        **snapshot_order_accounting(
            db,
            item_id=item["id"],
            tariff_id=tariff["id"],
        ),
    ))
    db.commit()

    try:
        resp = await platega.create_payment(
            order_id=external_order_id,
            amount=float(amount),
            method=method,
            description=f"{item['name']} / {tariff['title']}",
            currency="RUB",
            payload=f"bot_purchase:{external_order_id}",
            return_url=(
                f"{_public_site_url()}/purchase/delivery"
                f"?order_id={external_order_id}&token={return_token}"
            ),
            failed_url=(
                f"{_public_site_url()}/purchase/delivery"
                f"?order_id={external_order_id}&token={return_token}"
            ),
        )
    except Exception as exc:
        db.query(BotOrder).filter(
            BotOrder.external_order_id == external_order_id
        ).update({"status": "failed"})
        db.commit()
        raise HTTPException(502, f"Platega error: {exc}") from exc

    payment_url = _callback_value(resp, "redirect", "url")
    transaction_id = _callback_value(
        resp,
        "transactionId",
        "transaction_id",
        "id",
    )

    if not payment_url or not transaction_id:
        db.query(BotOrder).filter(
            BotOrder.external_order_id == external_order_id
        ).update({"status": "failed"})
        db.commit()
        raise HTTPException(502, "Platega returned an incomplete payment response")

    bot_order = db.query(BotOrder).filter(
        BotOrder.external_order_id == external_order_id
    ).with_for_update().first()
    if not bot_order:
        raise HTTPException(500, "Purchase order disappeared before payment setup")
    bot_order.platega_tx_id = str(transaction_id)
    db.commit()

    return {
        "order_id": external_order_id,
        "transaction_id": transaction_id,
        "payment_url": payment_url,
        "amount": float(amount),
        "expected_payment_amount": float(expected_payment_amount),
        "currency": "RUB",
    }


@router.get("/bot-orders/{order_id}/status")
def get_bot_order_status(
    order_id: int,
    response: Response,
    token: str = Header(..., alias="X-Order-Access-Token", min_length=32, max_length=64),
    db: Session = Depends(get_db),
):
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    order = db.query(BotOrder).filter(
        BotOrder.external_order_id == order_id
    ).first()
    if (
        order is None
        or order.return_token_hash is None
        or not hmac.compare_digest(order.return_token_hash, token_hash)
    ):
        raise HTTPException(status_code=404, detail="Заказ не найден")

    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    instruction_link = db.execute(text("""
        SELECT instruction_link
        FROM items
        WHERE alias = :item_alias
        LIMIT 1
    """), {"item_alias": order.item_alias}).scalar_one_or_none()

    return {
        "order_id": order.external_order_id,
        "status": order.status,
        "product": order.product,
        "period": order.period,
        "amount": float(order.amount) if order.amount is not None else None,
        "currency": "RUB",
        "key_value": order.key_value if order.status == "completed" else None,
        "instruction_link": instruction_link,
    }


@router.get("/rate")
async def crypto_rate():
    """Курс RUB → USDT для витрины."""
    try:
        return await platega.get_rate(13, "RUB", "USDT")
    except Exception as e:
        return {"error": str(e)}
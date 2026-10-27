from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models import (
    AccountingEntry,
    AccountingItemCost,
    AccountingSettings,
    BotOrder,
)

MONEY = Decimal("0.01")


def snapshot_order_accounting(
    db: Session,
    *,
    item_id: int,
    tariff_id: int,
) -> dict:
    item_cost = db.query(AccountingItemCost).filter(
        AccountingItemCost.item_id == item_id,
        AccountingItemCost.tariff_id == tariff_id,
    ).first()
    return {
        "accounting_item_id": item_id,
        "accounting_tariff_id": tariff_id,
        "accounting_cost_amount": item_cost.cost_amount if item_cost else None,
        "accounting_commission_percent": get_commission_percent(db),
    }


def get_commission_percent(db: Session) -> Decimal:
    settings = db.query(AccountingSettings).filter(AccountingSettings.id == 1).first()
    return Decimal(str(settings.management_commission_percent)) if settings else Decimal("0")


def record_topup_credit(
    db: Session,
    *,
    origin_key: str,
    amount: Decimal,
) -> None:
    if db.query(AccountingEntry.id).filter(AccountingEntry.origin_key == origin_key).first():
        return
    db.add(AccountingEntry(
        origin_key=origin_key,
        entry_type="topup_credit",
        turnover_amount=amount.quantize(MONEY, rounding=ROUND_HALF_UP),
        cost_amount=Decimal("0"),
        profit_amount=Decimal("0"),
    ))
    db.flush()


def record_topup_chargeback(
    db: Session,
    *,
    origin_key: str,
    amount: Decimal,
) -> None:
    if db.query(AccountingEntry.id).filter(AccountingEntry.origin_key == origin_key).first():
        return
    db.add(AccountingEntry(
        origin_key=origin_key,
        entry_type="topup_chargeback",
        turnover_amount=(-amount).quantize(MONEY, rounding=ROUND_HALF_UP),
        cost_amount=Decimal("0"),
        profit_amount=Decimal("0"),
    ))
    db.flush()


def record_bot_order_sale(db: Session, order: BotOrder) -> None:
    origin_key = f"bot-order:{order.external_order_id}"
    if order.accounting_item_id is None:
        return
    if db.query(AccountingEntry.id).filter(AccountingEntry.origin_key == origin_key).first():
        return

    amount = Decimal(str(order.amount or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)
    cost = (
        Decimal(str(order.accounting_cost_amount)).quantize(MONEY, rounding=ROUND_HALF_UP)
        if order.accounting_cost_amount is not None
        else None
    )
    commission_percent = Decimal(str(order.accounting_commission_percent or 0))
    commission = (amount * commission_percent / Decimal("100")).quantize(
        MONEY,
        rounding=ROUND_HALF_UP,
    )
    profit = amount - cost - commission if cost is not None else None
    is_balance = (order.payment or "").strip().casefold() in {"баланс", "balance"}

    db.add(AccountingEntry(
        origin_key=origin_key,
        entry_type="sale",
        turnover_amount=Decimal("0") if is_balance else amount,
        sale_amount=amount,
        cost_amount=cost,
        commission_amount=commission,
        profit_amount=profit,
        product_name=" / ".join(
            part for part in (order.product, order.period) if part
        ) or order.item_alias,
        payment_method=order.payment,
    ))
    db.flush()


def record_bot_order_chargeback(db: Session, order: BotOrder) -> None:
    origin_key = f"bot-order-chargeback:{order.external_order_id}"
    sale = (
        db.query(AccountingEntry)
        .filter(AccountingEntry.origin_key == f"bot-order:{order.external_order_id}")
        .first()
    )
    if sale is None or db.query(AccountingEntry.id).filter(
        AccountingEntry.origin_key == origin_key
    ).first():
        return

    db.add(AccountingEntry(
        origin_key=origin_key,
        entry_type="sale_chargeback",
        turnover_amount=-sale.turnover_amount,
        sale_amount=-sale.sale_amount,
        cost_amount=-sale.cost_amount if sale.cost_amount is not None else None,
        commission_amount=-sale.commission_amount,
        profit_amount=-sale.profit_amount if sale.profit_amount is not None else None,
        product_name=sale.product_name,
        payment_method=sale.payment_method,
    ))
    db.flush()

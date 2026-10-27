from datetime import date, datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, case, func, select, text
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database import get_db
from app.models import (
    AccountingEntry,
    AccountingExpense,
    AccountingItemCost,
    AccountingSettings,
    User,
)
from app.services.legacy_catalog import parse_legacy_tariffs

router = APIRouter(
    prefix="/api/admin/accounting",
    tags=["admin-accounting"],
    dependencies=[Depends(get_current_admin)],
)


class CommissionUpdate(BaseModel):
    management_commission_percent: Decimal = Field(
        ge=0,
        le=100,
        max_digits=6,
        decimal_places=3,
    )


class ItemCostUpdate(BaseModel):
    item_id: int = Field(gt=0)
    tariff_id: int = Field(gt=0)
    cost_amount: Decimal = Field(ge=0, le=1_000_000_000, max_digits=12, decimal_places=2)


class ExpenseCreate(BaseModel):
    amount: Decimal = Field(gt=0, le=1_000_000_000, max_digits=12, decimal_places=2)
    occurred_at: datetime
    category: str = Field(min_length=1, max_length=64)
    description: str = Field(min_length=1, max_length=2000)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


@router.get("/settings")
def get_accounting_settings(
    db: Session = Depends(get_db),
):
    settings = db.get(AccountingSettings, 1)
    costs = {
        (cost.item_id, cost.tariff_id): cost.cost_amount
        for cost in db.scalars(select(AccountingItemCost)).all()
    }
    rows = db.execute(text("""
        SELECT id, COALESCE(name, '') AS name, COALESCE(alias, '') AS alias, tabs, prices
        FROM items
        ORDER BY name, id
    """)).mappings().all()
    items = []
    for row in rows:
        tariffs = parse_legacy_tariffs(row["tabs"], row["prices"])
        items.append({
            "id": row["id"],
            "name": row["name"],
            "alias": row["alias"],
            "tariffs": [
                {
                    "id": tariff["id"],
                    "title": tariff["title"],
                    "price": tariff["price"],
                    "cost_amount": (
                        float(costs[(row["id"], tariff["id"])])
                        if (row["id"], tariff["id"]) in costs
                        else None
                    ),
                }
                for tariff in tariffs
            ],
        })
    return {
        "management_commission_percent": (
            float(settings.management_commission_percent) if settings else 0
        ),
        "items": items,
    }


@router.put("/commission")
def update_commission(
    payload: CommissionUpdate,
    db: Session = Depends(get_db),
):
    settings = db.get(AccountingSettings, 1)
    if settings is None:
        settings = AccountingSettings(id=1)
        db.add(settings)
    settings.management_commission_percent = payload.management_commission_percent
    db.commit()
    return {
        "management_commission_percent": float(
            settings.management_commission_percent
        )
    }


@router.put("/item-cost")
def update_item_cost(
    payload: ItemCostUpdate,
    db: Session = Depends(get_db),
):
    item = db.execute(text("""
        SELECT tabs, prices
        FROM items
        WHERE id = :item_id
        LIMIT 1
    """), {"item_id": payload.item_id}).mappings().first()
    if item is None:
        raise HTTPException(404, "Товар не найден")
    tariffs = parse_legacy_tariffs(item["tabs"], item["prices"])
    if not any(tariff["id"] == payload.tariff_id for tariff in tariffs):
        raise HTTPException(404, "Тариф не найден")

    cost = db.query(AccountingItemCost).filter(
        AccountingItemCost.item_id == payload.item_id,
        AccountingItemCost.tariff_id == payload.tariff_id,
    ).with_for_update().first()
    if cost is None:
        cost = AccountingItemCost(
            item_id=payload.item_id,
            tariff_id=payload.tariff_id,
            cost_amount=payload.cost_amount,
        )
        db.add(cost)
    else:
        cost.cost_amount = payload.cost_amount
    db.commit()
    return {
        "item_id": payload.item_id,
        "tariff_id": payload.tariff_id,
        "cost_amount": float(payload.cost_amount),
    }


@router.post("/expenses", status_code=201)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    occurred_at = payload.occurred_at
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=timezone.utc)
    category = payload.category.strip()
    description = payload.description.strip()
    if not category or not description:
        raise HTTPException(422, "Укажите категорию и описание расхода")
    expense = AccountingExpense(
        amount=payload.amount.quantize(Decimal("0.01")),
        occurred_at=occurred_at,
        category=category,
        description=description,
        created_by=admin.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return {
        "id": expense.id,
        "amount": float(expense.amount),
        "occurred_at": _iso(expense.occurred_at),
        "category": expense.category,
        "description": expense.description,
    }


@router.get("/summary")
def get_accounting_summary(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    start = (
        datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        if date_from
        else None
    )
    end = (
        datetime.combine(date_to, time.max, tzinfo=timezone.utc)
        if date_to
        else None
    )
    if start and end and start > end:
        raise HTTPException(400, "Дата начала периода позже даты окончания")

    entry_query = select(AccountingEntry)
    expense_query = select(AccountingExpense)
    if start:
        entry_query = entry_query.where(AccountingEntry.created_at >= start)
        expense_query = expense_query.where(AccountingExpense.occurred_at >= start)
    if end:
        entry_query = entry_query.where(AccountingEntry.created_at <= end)
        expense_query = expense_query.where(AccountingExpense.occurred_at <= end)

    entries = list(db.scalars(
        entry_query.order_by(AccountingEntry.created_at.desc()).limit(limit)
    ).all())
    expenses = list(db.scalars(
        expense_query.order_by(AccountingExpense.occurred_at.desc()).limit(limit)
    ).all())
    totals_query = select(
        func.coalesce(func.sum(AccountingEntry.turnover_amount), 0).label("turnover"),
        func.coalesce(func.sum(AccountingEntry.sale_amount), 0).label("sales"),
        func.coalesce(func.sum(AccountingEntry.cost_amount), 0).label("costs"),
        func.coalesce(func.sum(AccountingEntry.commission_amount), 0).label("commissions"),
        func.coalesce(func.sum(AccountingEntry.profit_amount), 0).label("profit"),
        func.coalesce(func.sum(
            case((AccountingEntry.profit_amount.is_(None), 1), else_=0)
        ), 0).label("unknown_profit_count"),
        func.coalesce(func.sum(
            case((
                and_(
                    AccountingEntry.entry_type == "sale",
                    AccountingEntry.cost_amount.is_(None),
                ),
                1,
            ), else_=0)
        ), 0).label("sales_missing_cost_count"),
    )
    if start:
        totals_query = totals_query.where(AccountingEntry.created_at >= start)
    if end:
        totals_query = totals_query.where(AccountingEntry.created_at <= end)
    totals = db.execute(totals_query).one()
    expense_total_query = select(
        func.coalesce(func.sum(AccountingExpense.amount), 0)
    )
    if start:
        expense_total_query = expense_total_query.where(
            AccountingExpense.occurred_at >= start
        )
    if end:
        expense_total_query = expense_total_query.where(
            AccountingExpense.occurred_at <= end
        )
    expenses_total = db.scalar(expense_total_query)
    known_profit = Decimal(str(totals.profit))
    expenses_total = Decimal(str(expenses_total or 0))
    has_complete_profit = totals.unknown_profit_count == 0

    return {
        "period": {
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
        },
        "totals": {
            "turnover": float(totals.turnover),
            "sales": float(totals.sales),
            "costs": float(totals.costs),
            "commissions": float(totals.commissions),
            "gross_profit": float(known_profit) if has_complete_profit else None,
            "expenses": float(expenses_total),
            "net_profit": (
                float(known_profit - expenses_total) if has_complete_profit else None
            ),
            "sales_missing_cost_count": totals.sales_missing_cost_count or 0,
        },
        "entries": [
            {
                "id": entry.id,
                "type": entry.entry_type,
                "product_name": entry.product_name,
                "payment_method": entry.payment_method,
                "turnover_amount": float(entry.turnover_amount),
                "sale_amount": float(entry.sale_amount),
                "cost_amount": (
                    float(entry.cost_amount) if entry.cost_amount is not None else None
                ),
                "commission_amount": float(entry.commission_amount),
                "profit_amount": (
                    float(entry.profit_amount)
                    if entry.profit_amount is not None
                    else None
                ),
                "created_at": _iso(entry.created_at),
            }
            for entry in entries
        ],
        "expenses_list": [
            {
                "id": expense.id,
                "amount": float(expense.amount),
                "occurred_at": _iso(expense.occurred_at),
                "category": expense.category,
                "description": expense.description,
            }
            for expense in expenses
        ],
    }

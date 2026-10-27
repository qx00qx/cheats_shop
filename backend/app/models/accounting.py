from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AccountingSettings(Base):
    __tablename__ = "accounting_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    management_commission_percent: Mapped[Decimal] = mapped_column(
        Numeric(7, 3),
        default=Decimal("0"),
        server_default="0",
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )


class AccountingItemCost(Base):
    __tablename__ = "accounting_item_costs"
    __table_args__ = (
        UniqueConstraint("item_id", "tariff_id", name="uq_accounting_item_tariff"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(Integer, index=True)
    tariff_id: Mapped[int] = mapped_column(Integer)
    cost_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )


class AccountingEntry(Base):
    __tablename__ = "accounting_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    origin_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    entry_type: Mapped[str] = mapped_column(String(32), index=True)
    turnover_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0"),
        server_default="0",
    )
    sale_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0"),
        server_default="0",
    )
    cost_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    commission_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("0"),
        server_default="0",
    )
    profit_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    product_name: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )


class AccountingExpense(Base):
    __tablename__ = "accounting_expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    category: Mapped[str] = mapped_column(String(64), default="advertising")
    description: Mapped[str] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

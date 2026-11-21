from datetime import datetime
from decimal import Decimal
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "discount_percent >= 0 AND discount_percent <= 10",
            name="ck_users_discount_percent",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    balance: Mapped[str] = mapped_column(String(32), default="0")
    discount_percent: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_spent: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, server_default="0")
    referral_discount_used: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    referral_code: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    referred_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    orders = relationship("Order", back_populates="user")


class BalanceAudit(Base):
    __tablename__ = "balance_audit"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    field: Mapped[str | None] = mapped_column(String(16), nullable=True)
    old_balance: Mapped[str | None] = mapped_column("old_val", String(64), nullable=True)
    new_balance: Mapped[str | None] = mapped_column("new_val", String(64), nullable=True)
    delta: Mapped[Decimal | None] = mapped_column(Numeric(20, 4), nullable=True)
    ctx: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        "changed_at",
        DateTime(timezone=False),
        server_default=func.now(),
        nullable=True,
    )

    @classmethod
    def for_balance_change(
        cls,
        *,
        user_id: int,
        old_balance: Decimal | int | float | str,
        new_balance: Decimal | int | float | str,
        ctx: str,
    ) -> "BalanceAudit":
        old_value = Decimal(str(old_balance))
        new_value = Decimal(str(new_balance))
        return cls(
            user_id=user_id,
            field="balance",
            old_balance=format(old_value, "f"),
            new_balance=format(new_value, "f"),
            delta=new_value - old_value,
            ctx=ctx,
        )
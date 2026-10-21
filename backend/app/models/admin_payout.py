from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AdminPayout(Base):
    __tablename__ = "admin_payouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    admin_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount_rub: Mapped[int] = mapped_column(Integer)
    card_last4: Mapped[str] = mapped_column(String(4))
    status: Mapped[str] = mapped_column(String(24), default="processing")
    idempotency_key: Mapped[str] = mapped_column(String(36), unique=True)
    provider_transaction_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    provider_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

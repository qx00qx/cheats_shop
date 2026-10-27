from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, ForeignKey, Numeric, DateTime, func, Integer, BigInteger, Text, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    payment_method: Mapped[str] = mapped_column(String(32))
    promo_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    platega_tx_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    platega_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    key_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    key_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    email_next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(Integer)
    plan_id: Mapped[int] = mapped_column(Integer)
    qty: Mapped[int] = mapped_column(Integer, default=1)
    price: Mapped[float] = mapped_column(Numeric(12, 2))
    key_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    key_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivered_qty: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    order = relationship("Order", back_populates="items")


class BotOrder(Base):
    __tablename__ = "bot_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_order_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    item_alias: Mapped[str] = mapped_column(String(255), index=True)
    platega_tx_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    return_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payment: Mapped[str | None] = mapped_column(String(128), nullable=True)
    game: Mapped[str | None] = mapped_column(String(128), nullable=True)
    product: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    period: Mapped[str | None] = mapped_column(String(255), nullable=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    expected_payment_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    site_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    source_order_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    source_order_item_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    accounting_item_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    accounting_tariff_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    accounting_cost_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    accounting_commission_percent: Mapped[Decimal | None] = mapped_column(
        Numeric(7, 3),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)
    key_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    key_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_file: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    delivery_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    email_next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notification_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    guest_payment_notification_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class Key(Base):
    __tablename__ = "keys"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    item_alias: Mapped[str] = mapped_column(String(255), index=True)
    key_value: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="free", index=True)
    added_by_tg_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    used_by_tg_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
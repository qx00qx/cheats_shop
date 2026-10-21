from datetime import datetime
from decimal import Decimal
from sqlalchemy import BigInteger, DateTime, Integer, LargeBinary, Numeric, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Key(Base):
    __tablename__ = "keys"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # если у тебя в сайте есть items.id — можно использовать это поле
    item_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)

    # если удобнее работать по alias/slug товара
    item_alias: Mapped[str] = mapped_column(String(255), index=True)

    # сам ключ
    key_value: Mapped[str] = mapped_column(Text, unique=True, nullable=False)

    # free / used
    status: Mapped[str] = mapped_column(String(16), default="free", index=True)

    # кто добавил ключ
    added_by_tg_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # кто использовал ключ
    used_by_tg_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

class Order(Base):
    __tablename__ = "bot_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # это твой внешний OrderId, например 56702
    external_order_id: Mapped[int] = mapped_column(
        BigInteger,
        unique=True,
        index=True,
        nullable=False,
    )

    item_alias: Mapped[str] = mapped_column(String(128), index=True)
    payment: Mapped[str | None] = mapped_column(String(128), nullable=True)
    game: Mapped[str | None] = mapped_column(String(128), nullable=True)
    product: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    period: Mapped[str | None] = mapped_column(String(255), nullable=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    site_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    source_order_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    source_order_item_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)
    key_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    key_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_file: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    delivery_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    notification_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    guest_payment_notification_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
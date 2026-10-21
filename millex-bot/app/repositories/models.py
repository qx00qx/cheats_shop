from datetime import datetime
from sqlalchemy import BigInteger, DateTime, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Key(Base):
    __tablename__ = "keys"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # если у тебя в сайте есть items.id — можно использовать это поле
    item_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)

    # если удобнее работать по alias/slug товара
    item_alias: Mapped[str] = mapped_column(String(128), index=True)

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
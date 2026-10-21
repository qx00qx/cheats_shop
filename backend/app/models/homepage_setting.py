from datetime import datetime

from sqlalchemy import DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class HomepageSetting(Base):
    __tablename__ = "homepage_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    telegram_card_background_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ReferralEarning(Base):
    __tablename__ = "referral_earnings"
    __table_args__ = (
        UniqueConstraint(
            "source_type",
            "source_id",
            name="uq_referral_earnings_source",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    referrer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    referred_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    source_type: Mapped[str] = mapped_column(String(24))
    source_id: Mapped[int] = mapped_column(BigInteger)
    sale_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    reversed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

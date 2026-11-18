from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import text
from sqlalchemy.orm import Session


PROMOTION_CAMPAIGN_KEY = "launch_week_15"
CHEAT_PROMOTION_DISCOUNT_PERCENT = 20
CHEAT_PROMOTION_ENDS_AT = datetime(
    2026,
    11,
    15,
    0,
    0,
    tzinfo=timezone(timedelta(hours=3)),
)
MAX_LOYALTY_DISCOUNT_PERCENT = 10


def promotion_window(
    starts_at: datetime,
) -> tuple[datetime, datetime]:
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=timezone.utc)
    ends_at = CHEAT_PROMOTION_ENDS_AT
    return starts_at, ends_at


def is_cheat_promotion_active(
    starts_at: datetime,
    now: datetime | None = None,
) -> bool:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    start, end = promotion_window(starts_at)
    return start <= current < end


def get_promotion_start(db: Session) -> datetime:
    starts_at = db.execute(
        text(
            "SELECT starts_at FROM global_promotions "
            "WHERE campaign_key = :campaign_key"
        ),
        {"campaign_key": PROMOTION_CAMPAIGN_KEY},
    ).scalar_one_or_none()
    if starts_at is None:
        raise RuntimeError(
            "Global promotion is not initialized; restart the backend to initialize it."
        )
    return starts_at


def effective_cheat_discount_percent(
    loyalty_discount_percent: int | None = 0,
    starts_at: datetime | None = None,
    now: datetime | None = None,
) -> int:
    loyalty_discount = min(
        MAX_LOYALTY_DISCOUNT_PERCENT,
        max(0, int(loyalty_discount_percent or 0)),
    )
    promotion_discount = (
        CHEAT_PROMOTION_DISCOUNT_PERCENT
        if starts_at is not None and is_cheat_promotion_active(starts_at, now)
        else 0
    )
    return max(loyalty_discount, promotion_discount)


def discounted_cheat_price(price: Decimal, discount_percent: int) -> Decimal:
    return (price * Decimal(100 - discount_percent) / Decimal(100)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def cheat_promotion_public_fields(db: Session) -> dict:
    starts_at = get_promotion_start(db)
    start, end = promotion_window(starts_at)
    active = is_cheat_promotion_active(start)
    return {
        "promo_discount_percent": CHEAT_PROMOTION_DISCOUNT_PERCENT if active else 0,
        "promo_expires_at": end.isoformat(),
    }


def cheat_promotion_payload(db: Session) -> dict:
    starts_at = get_promotion_start(db)
    start, end = promotion_window(starts_at)
    return {
        "active": is_cheat_promotion_active(start),
        "discount_percent": CHEAT_PROMOTION_DISCOUNT_PERCENT,
        "starts_at": start.isoformat(),
        "ends_at": end.isoformat(),
    }

from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP


CHEAT_PROMOTION_DISCOUNT_PERCENT = 11
CHEAT_PROMOTION_STARTS_AT = datetime(2026, 10, 28, 0, 0, 0, tzinfo=timezone.utc)
CHEAT_PROMOTION_ENDS_AT = CHEAT_PROMOTION_STARTS_AT + timedelta(days=7)
MAX_LOYALTY_DISCOUNT_PERCENT = 10


def is_cheat_promotion_active(now: datetime | None = None) -> bool:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return CHEAT_PROMOTION_STARTS_AT <= current < CHEAT_PROMOTION_ENDS_AT


def effective_cheat_discount_percent(
    loyalty_discount_percent: int | None = 0,
    now: datetime | None = None,
) -> int:
    loyalty_discount = min(
        MAX_LOYALTY_DISCOUNT_PERCENT,
        max(0, int(loyalty_discount_percent or 0)),
    )
    promotion_discount = (
        CHEAT_PROMOTION_DISCOUNT_PERCENT if is_cheat_promotion_active(now) else 0
    )
    return max(loyalty_discount, promotion_discount)


def discounted_cheat_price(price: Decimal, discount_percent: int) -> Decimal:
    return (price * Decimal(100 - discount_percent) / Decimal(100)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def cheat_promotion_public_fields() -> dict:
    active = is_cheat_promotion_active()
    return {
        "promo_discount_percent": CHEAT_PROMOTION_DISCOUNT_PERCENT if active else 0,
        "promo_expires_at": CHEAT_PROMOTION_ENDS_AT.isoformat(),
    }


def cheat_promotion_payload() -> dict:
    return {
        "active": is_cheat_promotion_active(),
        "discount_percent": CHEAT_PROMOTION_DISCOUNT_PERCENT,
        "starts_at": CHEAT_PROMOTION_STARTS_AT.isoformat(),
        "ends_at": CHEAT_PROMOTION_ENDS_AT.isoformat(),
    }

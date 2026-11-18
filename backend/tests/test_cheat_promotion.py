from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.services.cheat_promotion import (
    CHEAT_PROMOTION_ENDS_AT,
    discounted_cheat_price,
    effective_cheat_discount_percent,
    is_cheat_promotion_active,
    promotion_window,
)
from app.services.user_discount import increase_user_discount


def test_cheat_promotion_ends_after_november_14_in_moscow():
    starts_at = datetime(2026, 11, 5, 10, 0, tzinfo=timezone.utc)
    _, ends_at = promotion_window(starts_at)
    assert ends_at == CHEAT_PROMOTION_ENDS_AT
    assert ends_at.astimezone(timezone.utc) == datetime(
        2026,
        11,
        14,
        21,
        0,
        tzinfo=timezone.utc,
    )
    assert is_cheat_promotion_active(starts_at, starts_at)
    assert is_cheat_promotion_active(
        starts_at,
        ends_at - timedelta(microseconds=1),
    )
    assert not is_cheat_promotion_active(starts_at, ends_at)


def test_cheat_promotion_takes_precedence_over_loyalty_discount():
    starts_at = datetime(2026, 11, 5, 10, 0, tzinfo=timezone.utc)
    _, ends_at = promotion_window(starts_at)
    assert effective_cheat_discount_percent(
        0,
        starts_at=starts_at,
        now=starts_at,
    ) == 20
    assert effective_cheat_discount_percent(
        10,
        starts_at=starts_at,
        now=starts_at,
    ) == 20
    assert effective_cheat_discount_percent(
        10,
        starts_at=starts_at,
        now=ends_at,
    ) == 10


def test_cheat_promotion_price_uses_currency_rounding():
    assert discounted_cheat_price(Decimal("1000.00"), 20) == Decimal("800.00")
    assert discounted_cheat_price(Decimal("99.99"), 20) == Decimal("79.99")


def test_loyalty_discount_accumulates_during_promotion_and_applies_after():
    starts_at = datetime(2026, 11, 5, 10, 0, tzinfo=timezone.utc)
    _, ends_at = promotion_window(starts_at)

    class UserStub:
        discount_percent = 4

    user = UserStub()

    assert increase_user_discount(user) == 5
    assert effective_cheat_discount_percent(
        user.discount_percent,
        starts_at=starts_at,
        now=starts_at,
    ) == 20
    assert effective_cheat_discount_percent(
        user.discount_percent,
        starts_at=starts_at,
        now=ends_at,
    ) == 5

from datetime import timedelta
from decimal import Decimal

from app.services.cheat_promotion import (
    CHEAT_PROMOTION_ENDS_AT,
    CHEAT_PROMOTION_STARTS_AT,
    discounted_cheat_price,
    effective_cheat_discount_percent,
    is_cheat_promotion_active,
)
from app.services.user_discount import increase_user_discount


def test_cheat_promotion_is_active_for_seven_days():
    assert CHEAT_PROMOTION_ENDS_AT - CHEAT_PROMOTION_STARTS_AT == timedelta(days=7)
    assert is_cheat_promotion_active(CHEAT_PROMOTION_STARTS_AT)
    assert is_cheat_promotion_active(CHEAT_PROMOTION_ENDS_AT - timedelta(microseconds=1))
    assert not is_cheat_promotion_active(CHEAT_PROMOTION_ENDS_AT)


def test_cheat_promotion_takes_precedence_over_loyalty_discount():
    assert effective_cheat_discount_percent(
        0,
        now=CHEAT_PROMOTION_STARTS_AT,
    ) == 11
    assert effective_cheat_discount_percent(
        10,
        now=CHEAT_PROMOTION_STARTS_AT,
    ) == 11
    assert effective_cheat_discount_percent(
        10,
        now=CHEAT_PROMOTION_ENDS_AT,
    ) == 10


def test_cheat_promotion_price_uses_currency_rounding():
    assert discounted_cheat_price(Decimal("1000.00"), 11) == Decimal("890.00")
    assert discounted_cheat_price(Decimal("99.99"), 11) == Decimal("88.99")


def test_loyalty_discount_accumulates_during_promotion_and_applies_after():
    class UserStub:
        discount_percent = 4

    user = UserStub()

    assert increase_user_discount(user) == 5
    assert effective_cheat_discount_percent(
        user.discount_percent,
        now=CHEAT_PROMOTION_STARTS_AT,
    ) == 11
    assert effective_cheat_discount_percent(
        user.discount_percent,
        now=CHEAT_PROMOTION_ENDS_AT,
    ) == 5

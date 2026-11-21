from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.services.cheat_promotion import (
    CHEAT_PROMOTION_ENDS_AT,
    discounted_cheat_price,
    effective_cheat_discount_percent,
    is_cheat_promotion_active,
    promotion_window,
)
from app.services.user_discount import (
    effective_user_discount_percent,
    record_successful_purchase,
    user_bonus_summary,
)


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


def test_loyalty_discount_accumulates_by_spent_amount():
    class UserStub:
        discount_percent = 0
        total_spent = Decimal("4000")
        referred_by = None
        referral_discount_used = False

    user = UserStub()
    starts_at = datetime(2026, 11, 5, 10, 0, tzinfo=timezone.utc)
    _, ends_at = promotion_window(starts_at)

    assert record_successful_purchase(user, Decimal("1000")) == 5
    assert user.total_spent == Decimal("5000.00")
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


def test_loyalty_discount_uses_full_thousands_and_caps_at_ten_percent():
    class UserStub:
        discount_percent = 0
        total_spent = Decimal("0")
        referred_by = None
        referral_discount_used = False

    user = UserStub()
    assert record_successful_purchase(user, Decimal("999.99")) == 0
    assert record_successful_purchase(user, Decimal("0.01")) == 1
    assert user_bonus_summary(user)["amount_to_next_discount"] == 1000.0
    assert record_successful_purchase(user, Decimal("12000")) == 10

    summary = user_bonus_summary(user)
    assert summary["discount_percent"] == 10
    assert summary["progress_percent"] == 100
    assert summary["amount_to_next_discount"] == 0.0


def test_referral_discount_applies_once_to_first_purchase():
    class UserStub:
        discount_percent = 0
        total_spent = Decimal("0")
        referred_by = 7
        referral_discount_used = False

    user = UserStub()
    assert effective_user_discount_percent(user, 0) == 5
    assert effective_user_discount_percent(user, 20) == 20
    assert record_successful_purchase(user, Decimal("1000")) == 1
    assert user.referral_discount_used is True
    assert effective_user_discount_percent(user, 1) == 1
    assert user_bonus_summary(user)["referral_discount_available"] is False

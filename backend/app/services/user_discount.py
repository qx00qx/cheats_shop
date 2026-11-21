from decimal import Decimal, ROUND_HALF_UP

from app.models import User


MAX_DISCOUNT_PERCENT = 10
DISCOUNT_STEP_AMOUNT = Decimal("1000")
REFERRAL_FIRST_PURCHASE_DISCOUNT_PERCENT = 5


def referral_first_purchase_available(user: User) -> bool:
    return bool(
        user.referred_by
        and not user.referral_discount_used
        and Decimal(str(user.total_spent or 0)) <= 0
    )


def effective_user_discount_percent(user: User, regular_discount: int) -> int:
    referral_discount = (
        REFERRAL_FIRST_PURCHASE_DISCOUNT_PERCENT
        if referral_first_purchase_available(user)
        else 0
    )
    return max(regular_discount, referral_discount)


def record_successful_purchase(user: User, amount: Decimal) -> int:
    purchase_amount = max(Decimal("0"), Decimal(str(amount)))
    first_purchase_discount_available = referral_first_purchase_available(user)
    total_spent = Decimal(str(user.total_spent or 0)) + purchase_amount
    user.total_spent = total_spent.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    user.discount_percent = min(
        MAX_DISCOUNT_PERCENT,
        int(total_spent // DISCOUNT_STEP_AMOUNT),
    )
    if first_purchase_discount_available:
        user.referral_discount_used = True
    return user.discount_percent


def user_bonus_summary(user: User) -> dict[str, object]:
    total_spent = max(Decimal("0"), Decimal(str(user.total_spent or 0)))
    discount_percent = min(
        MAX_DISCOUNT_PERCENT,
        int(total_spent // DISCOUNT_STEP_AMOUNT),
    )
    next_discount_percent = min(discount_percent + 1, MAX_DISCOUNT_PERCENT)
    amount_to_next = (
        max(
            Decimal("0"),
            Decimal(next_discount_percent) * DISCOUNT_STEP_AMOUNT - total_spent,
        )
        if discount_percent < MAX_DISCOUNT_PERCENT
        else Decimal("0")
    )
    return {
        "total_spent": float(total_spent),
        "discount_percent": discount_percent,
        "next_discount_percent": next_discount_percent,
        "amount_to_next_discount": float(amount_to_next),
        "progress_percent": min(100, int(total_spent * 100 / Decimal("10000"))),
        "referral_discount_percent": REFERRAL_FIRST_PURCHASE_DISCOUNT_PERCENT,
        "referral_discount_available": referral_first_purchase_available(user),
        "referral_discount_used": bool(user.referral_discount_used),
        "is_referred": bool(user.referred_by),
    }

from app.models import User


MAX_DISCOUNT_PERCENT = 10


def increase_user_discount(user: User) -> int:
    current_discount = min(
        MAX_DISCOUNT_PERCENT,
        max(0, int(user.discount_percent or 0)),
    )
    user.discount_percent = min(current_discount + 1, MAX_DISCOUNT_PERCENT)
    return user.discount_percent

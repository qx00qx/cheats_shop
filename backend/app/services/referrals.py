import secrets
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func
from sqlalchemy.orm import Session, aliased

from app.models import BalanceAudit, ReferralEarning, User

REFERRAL_COMMISSION_RATE = Decimal("0.05")


def ensure_referral_code(db: Session, user: User) -> str:
    if user.referral_code:
        return user.referral_code

    for _ in range(5):
        code = secrets.token_hex(6).upper()
        exists = db.query(User.id).filter(User.referral_code == code).first()
        if not exists:
            user.referral_code = code
            db.flush()
            return code

    raise RuntimeError("Unable to generate a unique referral code")


def award_referral_commission(
    db: Session,
    *,
    buyer: User,
    sale_amount: Decimal,
    source_type: str,
    source_id: int,
) -> Decimal:
    amount = Decimal(str(sale_amount))
    if amount <= 0 or not buyer.referred_by or buyer.referred_by == buyer.id:
        return Decimal("0.00")

    commission = (amount * REFERRAL_COMMISSION_RATE).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    if commission <= 0:
        return Decimal("0.00")

    existing = (
        db.query(ReferralEarning)
        .filter(
            ReferralEarning.source_type == source_type,
            ReferralEarning.source_id == source_id,
        )
        .with_for_update()
        .first()
    )
    if existing:
        return Decimal("0.00")

    referrer = (
        db.query(User)
        .filter(User.id == buyer.referred_by)
        .with_for_update()
        .first()
    )
    if referrer is None:
        raise RuntimeError("Referral owner no longer exists")

    old_balance = Decimal(str(referrer.balance or 0))
    new_balance = old_balance + commission
    referrer.balance = str(new_balance)
    db.add(ReferralEarning(
        referrer_id=referrer.id,
        referred_user_id=buyer.id,
        source_type=source_type,
        source_id=source_id,
        sale_amount=amount,
        commission_amount=commission,
    ))
    db.add(BalanceAudit.for_balance_change(
        user_id=referrer.id,
        old_balance=old_balance,
        new_balance=new_balance,
        ctx=f"REFERRAL:{source_type}:{source_id}",
    ))
    db.flush()
    return commission


def reverse_referral_commission(
    db: Session,
    *,
    source_type: str,
    source_id: int,
) -> Decimal:
    earning = (
        db.query(ReferralEarning)
        .filter(
            ReferralEarning.source_type == source_type,
            ReferralEarning.source_id == source_id,
        )
        .with_for_update()
        .first()
    )
    if earning is None or earning.reversed:
        return Decimal("0.00")

    referrer = (
        db.query(User)
        .filter(User.id == earning.referrer_id)
        .with_for_update()
        .first()
    )
    if referrer is None:
        raise RuntimeError("Referral owner no longer exists")

    commission = Decimal(str(earning.commission_amount))
    old_balance = Decimal(str(referrer.balance or 0))
    new_balance = old_balance - commission
    referrer.balance = str(new_balance)
    earning.reversed = True
    db.add(BalanceAudit.for_balance_change(
        user_id=referrer.id,
        old_balance=old_balance,
        new_balance=new_balance,
        ctx=f"REFERRAL_REVERSAL:{source_type}:{source_id}",
    ))
    db.flush()
    return commission


def referral_summary(db: Session, user_id: int) -> dict[str, object]:
    invited_count = db.query(func.count(User.id)).filter(
        User.referred_by == user_id
    ).scalar()
    earning_totals = db.query(
        func.count(ReferralEarning.id),
        func.coalesce(func.sum(ReferralEarning.commission_amount), 0),
    ).filter(
        ReferralEarning.referrer_id == user_id,
        ReferralEarning.reversed.is_(False),
    ).one()
    invitees = (
        db.query(User.id, User.username, User.created_at)
        .filter(User.referred_by == user_id)
        .order_by(User.created_at.desc(), User.id.desc())
        .all()
    )
    invitee_ids = [invitee.id for invitee in invitees]
    invitee_earnings = {}
    if invitee_ids:
        invitee_earnings = {
            row.referred_user_id: {
                "purchases_count": int(row.purchases_count or 0),
                "earned_total": float(row.earned_total or 0),
            }
            for row in db.query(
                ReferralEarning.referred_user_id,
                func.count(ReferralEarning.id).label("purchases_count"),
                func.coalesce(func.sum(ReferralEarning.commission_amount), 0).label(
                    "earned_total"
                ),
            ).filter(
                ReferralEarning.referrer_id == user_id,
                ReferralEarning.reversed.is_(False),
                ReferralEarning.referred_user_id.in_(invitee_ids),
            ).group_by(ReferralEarning.referred_user_id)
        }
    referrer = aliased(User)
    referrer_username = (
        db.query(referrer.username)
        .select_from(User)
        .join(referrer, referrer.id == User.referred_by)
        .filter(User.id == user_id)
        .scalar()
    )
    return {
        "invited_count": int(invited_count or 0),
        "purchases_count": int(earning_totals[0] or 0),
        "earned_total": float(earning_totals[1] or 0),
        "invited_by": referrer_username,
        "invitees": [
            {
                "username": invitee.username,
                "created_at": (
                    invitee.created_at.isoformat()
                    if invitee.created_at
                    else None
                ),
                **invitee_earnings.get(
                    invitee.id,
                    {"purchases_count": 0, "earned_total": 0.0},
                ),
            }
            for invitee in invitees
        ],
    }

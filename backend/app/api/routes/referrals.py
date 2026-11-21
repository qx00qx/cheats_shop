from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models import User
from app.services.referrals import ensure_referral_code, referral_summary
from app.services.user_discount import referral_first_purchase_available

router = APIRouter(prefix="/api/referrals", tags=["referrals"])


@router.get("/me")
def get_my_referral(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = (
        db.query(User)
        .filter(User.id == current_user.id)
        .with_for_update()
        .first()
    )
    if user is None:
        raise HTTPException(404, "User not found")

    code = ensure_referral_code(db, user)
    db.commit()
    return {
        "code": code,
        "link": f"{settings.SITE_URL.rstrip('/')}/register?ref={quote(code)}",
        "commission_percent": 5,
        "first_purchase_discount_percent": 5 if user.referred_by else 0,
        "first_purchase_discount_available": referral_first_purchase_available(user),
        "first_purchase_discount_used": bool(user.referral_discount_used),
        **referral_summary(db, user.id),
    }

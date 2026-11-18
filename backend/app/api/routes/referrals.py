from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models import User
from app.services.referrals import ensure_referral_code, referral_summary

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
        **referral_summary(db, user.id),
    }

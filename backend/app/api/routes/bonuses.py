from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models import User
from app.services.user_discount import user_bonus_summary

router = APIRouter(prefix="/api/bonuses", tags=["bonuses"])


@router.get("/me")
def get_my_bonuses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    return user_bonus_summary(user or current_user)

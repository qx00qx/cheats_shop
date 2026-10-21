from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Emailer
from app.schemas.emailer import EmailerCreate, EmailerOut
from app.api.deps import get_current_admin

router = APIRouter(prefix="/api/emailer", tags=["emailer"])


@router.get("", response_model=list[EmailerOut])
def list_emailer(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    return db.query(Emailer).order_by(Emailer.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{emailer_id}", response_model=EmailerOut)
def get_emailer(
    emailer_id: int,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    emailer = db.query(Emailer).filter(Emailer.id == emailer_id).first()
    if not emailer:
        raise HTTPException(404, "Emailer not found")
    return emailer


@router.post("", response_model=EmailerOut, status_code=201)
def create_emailer(
    payload: EmailerCreate,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    emailer = Emailer(**payload.model_dump())
    db.add(emailer)
    db.commit()
    db.refresh(emailer)
    return emailer


@router.post("/{emailer_id}/send", response_model=EmailerOut)
def send_emailer(
    emailer_id: int,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    emailer = db.query(Emailer).filter(Emailer.id == emailer_id).first()
    if not emailer:
        raise HTTPException(404, "Emailer not found")

    # TODO: Интегрировать реальную отправку email (например, через SMTP или SendGrid)
    # Для сейчас просто помечаем как отправленный
    emailer.last_send = func.now()
    emailer.is_sent = True
    db.commit()
    db.refresh(emailer)
    return emailer


@router.delete("/{emailer_id}")
def delete_emailer(
    emailer_id: int,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    emailer = db.query(Emailer).filter(Emailer.id == emailer_id).first()
    if not emailer:
        raise HTTPException(404, "Emailer not found")
    db.delete(emailer)
    db.commit()
    return {"message": "Deleted successfully"}

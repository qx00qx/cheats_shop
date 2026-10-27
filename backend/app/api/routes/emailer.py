import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.models import Emailer, User
from app.schemas.emailer import EmailerCreate, EmailerOut, EmailerStatus
from app.api.deps import get_current_admin
from app.services.amazon_ses import (
    amazon_ses_credentials_source,
    amazon_ses_is_configured,
    send_email,
)

router = APIRouter(prefix="/api/emailer", tags=["emailer"])
logger = logging.getLogger(__name__)


def _active_user_emails(db: Session) -> list[str]:
    addresses = (
        db.query(User.email)
        .filter(User.is_active.is_(True), User.email.is_not(None))
        .order_by(User.id)
        .all()
    )
    unique_addresses: dict[str, str] = {}
    for (address,) in addresses:
        if address and address.strip():
            unique_addresses.setdefault(address.strip().casefold(), address.strip())
    return list(unique_addresses.values())


def _send_campaign(emailer_id: int, recipients: list[str]) -> None:
    db = SessionLocal()
    sent_count = 0
    failed_count = 0
    first_error: str | None = None
    try:
        emailer = db.query(Emailer).filter(Emailer.id == emailer_id).first()
        if not emailer:
            logger.error("Amazon SES campaign %s disappeared before sending", emailer_id)
            return

        for recipient in recipients:
            try:
                send_email(
                    subject=emailer.subject,
                    from_email=emailer.from_email,
                    to_email=recipient,
                    body_html=emailer.body,
                    cc_email=emailer.cc_email,
                )
                sent_count += 1
            except RuntimeError as exc:
                failed_count += 1
                if first_error is None:
                    first_error = str(exc)[:2000]
                logger.warning(
                    "Amazon SES delivery failed for campaign %s (failure %s/%s): %s",
                    emailer_id,
                    failed_count,
                    len(recipients),
                    exc,
                )

            emailer.sent_count = sent_count
            emailer.failed_count = failed_count
            db.commit()

        emailer.send_status = (
            "sent" if failed_count == 0
            else "partial" if sent_count > 0
            else "failed"
        )
        emailer.is_sent = failed_count == 0 and sent_count > 0
        emailer.last_send = func.now() if sent_count else None
        emailer.last_error = first_error
        db.commit()
    finally:
        db.close()


@router.get("", response_model=list[EmailerOut])
def list_emailer(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    return db.query(Emailer).order_by(Emailer.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/status", response_model=EmailerStatus)
def get_emailer_status(
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    return EmailerStatus(
        configured=amazon_ses_is_configured(),
        region=settings.AMAZON_SES_REGION or None,
        credentials_source=amazon_ses_credentials_source(),
        active_recipient_count=len(_active_user_emails(db)),
    )


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
    emailer.send_status = "draft"
    db.add(emailer)
    db.commit()
    db.refresh(emailer)
    return emailer


@router.post("/{emailer_id}/send", response_model=EmailerOut)
def send_emailer(
    emailer_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    emailer = db.query(Emailer).filter(Emailer.id == emailer_id).first()
    if not emailer:
        raise HTTPException(404, "Emailer not found")

    if not amazon_ses_is_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Amazon SES is not configured. Set AMAZON_SES_REGION and valid AWS credentials.",
        )
    if emailer.send_status != "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Campaign cannot be sent while its status is '{emailer.send_status}'.",
        )

    recipients = (
        [emailer.to_email]
        if emailer.to_email
        else _active_user_emails(db)
    )
    if not recipients:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active user email addresses found.")

    started = db.execute(
        update(Emailer)
        .where(Emailer.id == emailer_id, Emailer.send_status == "draft")
        .values(
            send_status="sending",
            recipient_count=len(recipients),
            sent_count=0,
            failed_count=0,
            last_error=None,
        )
    )
    if started.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Campaign sending has already been started.",
        )
    db.commit()
    db.refresh(emailer)
    background_tasks.add_task(_send_campaign, emailer_id, recipients)
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
    if emailer.send_status == "sending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A campaign cannot be deleted while it is sending.",
        )
    db.delete(emailer)
    db.commit()
    return {"message": "Deleted successfully"}

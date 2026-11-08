import logging

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.models import Emailer, User
from app.schemas.emailer import EmailerCreate, EmailerOut, EmailerStatus
from app.api.deps import get_current_admin
from app.services.unisender_go import (
    MAX_RECIPIENTS_PER_REQUEST,
    send_email_batch,
    unisender_go_is_configured,
)

router = APIRouter(prefix="/api/emailer", tags=["emailer"])
logger = logging.getLogger(__name__)


def _user_emails(db: Session) -> list[str]:
    addresses = (
        db.query(User.email)
        .filter(User.email.is_not(None))
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
            logger.error("Unisender Go campaign %s disappeared before sending", emailer_id)
            return

        with httpx.Client(timeout=30) as client:
            for batch_index, batch_start in enumerate(
                range(0, len(recipients), MAX_RECIPIENTS_PER_REQUEST)
            ):
                batch = recipients[
                    batch_start:batch_start + MAX_RECIPIENTS_PER_REQUEST
                ]
                try:
                    failed_addresses = send_email_batch(
                        client,
                        subject=emailer.subject,
                        from_email=emailer.from_email,
                        recipients=batch,
                        body_html=emailer.body,
                        idempotence_key=f"emailer-{emailer_id}-{batch_index}",
                        cc_email=emailer.cc_email,
                    )
                    batch_failed = sum(
                        address.casefold() in failed_addresses
                        for address in batch
                    )
                    sent_count += len(batch) - batch_failed
                    failed_count += batch_failed
                    if batch_failed and first_error is None:
                        first_error = (
                            f"Unisender Go rejected {batch_failed} recipient(s)."
                        )
                except RuntimeError as exc:
                    failed_count += len(batch)
                    if first_error is None:
                        first_error = str(exc)[:2000]
                    logger.warning(
                        "Unisender Go failed campaign %s batch %s (%s recipients): %s",
                        emailer_id,
                        batch_index,
                        len(batch),
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
        configured=unisender_go_is_configured(),
        provider="Unisender Go",
        api_url=settings.UNISENDER_GO_API_URL,
        recipient_count=len(_user_emails(db)),
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

    if not unisender_go_is_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Unisender Go is not configured. Set UNISENDER_GO_API_KEY and UNISENDER_GO_API_URL.",
        )
    if emailer.send_status != "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Campaign cannot be sent while its status is '{emailer.send_status}'.",
        )

    recipients = (
        [emailer.to_email]
        if emailer.to_email
        else _user_emails(db)
    )
    if not recipients:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No user email addresses found.")

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

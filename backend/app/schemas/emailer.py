from pydantic import BaseModel, EmailStr
from datetime import datetime


class EmailerCreate(BaseModel):
    subject: str
    from_email: EmailStr
    to_email: EmailStr | None = None
    cc_email: EmailStr | None = None
    body: str


class EmailerStatus(BaseModel):
    configured: bool
    region: str | None
    credentials_source: str
    active_recipient_count: int


class EmailerOut(BaseModel):
    id: int
    created_at: datetime
    last_send: datetime | None
    subject: str
    from_email: str
    to_email: str | None
    cc_email: str | None
    body: str
    is_sent: bool
    send_status: str
    recipient_count: int
    sent_count: int
    failed_count: int
    last_error: str | None

    class Config:
        from_attributes = True

from pydantic import BaseModel, EmailStr
from datetime import datetime


class EmailerCreate(BaseModel):
    subject: str
    from_email: EmailStr
    to_email: EmailStr
    cc_email: EmailStr | None = None
    body: str


class EmailerOut(BaseModel):
    id: int
    created_at: datetime
    last_send: datetime | None
    subject: str
    from_email: str
    to_email: str
    cc_email: str | None
    body: str
    is_sent: bool

    class Config:
        from_attributes = True

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, PositiveInt, model_validator
from datetime import datetime


class EmailerCreate(BaseModel):
    subject: str
    from_email: EmailStr
    to_email: EmailStr | None = None
    cc_email: EmailStr | None = None
    body: str
    recipient_mode: Literal["all", "selected", "single"] | None = None
    recipient_ids: list[PositiveInt] = Field(default_factory=list, max_length=1000)

    @model_validator(mode="after")
    def validate_recipients(self):
        if self.recipient_mode is None:
            self.recipient_mode = "single" if self.to_email else "all"

        if len(set(self.recipient_ids)) != len(self.recipient_ids):
            raise ValueError("Selected user IDs must be unique.")

        if self.recipient_mode == "all" and (self.to_email or self.recipient_ids):
            raise ValueError("All-users campaigns cannot include individual recipients.")
        if self.recipient_mode == "selected" and (self.to_email or not self.recipient_ids):
            raise ValueError("Select at least one user for this campaign.")
        if self.recipient_mode == "single" and (not self.to_email or self.recipient_ids):
            raise ValueError("Enter one test email address.")
        return self


class EmailerStatus(BaseModel):
    configured: bool
    provider: str
    api_url: str
    recipient_count: int


class EmailRecipient(BaseModel):
    id: int
    username: str
    email: EmailStr


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
    recipient_emails: list[str]

    class Config:
        from_attributes = True

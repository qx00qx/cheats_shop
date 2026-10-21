from datetime import datetime
from pydantic import BaseModel, Field


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str | None = None


class ReviewOut(BaseModel):
    id: int
    user_id: int
    rating: int
    text: str | None
    created_at: datetime

    class Config:
        from_attributes = True
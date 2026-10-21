from datetime import datetime
from pydantic import BaseModel, Field


class OrderItemIn(BaseModel):
    product_id: int
    plan_id: int
    qty: int = Field(default=1, ge=1)


class OrderCreate(BaseModel):
    items: list[OrderItemIn]
    payment_method: str
    promo_code: str | None = None


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    plan_id: int
    qty: int
    price: float
    key_id: int | None = None
    key_value: str | None = None
    delivered_qty: int = 0

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    status: str
    total: float
    payment_method: str
    created_at: datetime
    platega_url: str | None = None
    key_value: str | None = None
    items: list[OrderItemOut] = []

    class Config:
        from_attributes = True


class OrderHistoryOut(BaseModel):
    id: int
    source: str
    status: str
    total: float
    payment_method: str
    created_at: datetime
    platega_url: str | None = None
    key_value: str | None = None
    delivery_file_available: bool = False
    product: str | None = None
    period: str | None = None
    items: list[OrderItemOut] = []
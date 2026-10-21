from pydantic import BaseModel, Field
from app.schemas.catalog import GameOut


class PlanOut(BaseModel):
    id: int
    label: str
    duration_days: int | None
    price: float
    old_price: float | None
    discount_badge: str | None

    class Config:
        from_attributes = True


class ProductShort(BaseModel):
    id: int
    slug: str
    title: str
    subtitle: str | None
    rating: float
    reviews_count: int

    class Config:
        from_attributes = True


class ProductFull(ProductShort):
    description: str | None
    features: list | None
    requirements: dict | None
    game: GameOut
    plans: list[PlanOut]


class ProductCreate(BaseModel):
    slug: str = Field(..., min_length=1, max_length=128)
    title: str = Field(..., min_length=1, max_length=255)
    game_id: int
    category_id: int | None = None
    subtitle: str | None = None
    description: str | None = None
    features: list | None = None
    requirements: dict | None = None
    rating: float = Field(default=5.0, ge=0, le=5)
    reviews_count: int = Field(default=0, ge=0)
    is_active: bool = Field(default=True)
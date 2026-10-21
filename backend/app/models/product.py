from sqlalchemy import String, Boolean, Integer, Numeric, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)

    subtitle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    features: Mapped[list | None] = mapped_column(JSON, default=list)
    requirements: Mapped[dict | None] = mapped_column(JSON, default=dict)

    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=5)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    game = relationship("Game", back_populates="products")
    plans = relationship("ProductPlan", back_populates="product", cascade="all, delete-orphan")


class ProductPlan(Base):
    __tablename__ = "product_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(64))
    duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(12, 2))
    old_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    discount_badge: Mapped[str | None] = mapped_column(String(32), nullable=True)

    product = relationship("Product", back_populates="plans")
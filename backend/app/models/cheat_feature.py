from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CheatFeatureCategory(Base):
    __tablename__ = "cheat_feature_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120), unique=True, index=True)


class CheatFeatureAssignment(Base):
    __tablename__ = "cheat_feature_assignments"
    __table_args__ = (
        UniqueConstraint("item_id", "category_id", name="uq_item_feature_category"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(Integer, index=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("cheat_feature_categories.id", ondelete="CASCADE"),
        index=True,
    )
    features: Mapped[str] = mapped_column(Text, default="[]")

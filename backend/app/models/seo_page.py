from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SeoPage(Base):
    __tablename__ = "seo_pages"

    page_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    image: Mapped[str] = mapped_column(String(2000), default="")
    noindex: Mapped[bool] = mapped_column(Boolean, default=False)

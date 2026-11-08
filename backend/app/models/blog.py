from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BlogCategory(Base):
    __tablename__ = "blog_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    alias: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    vis: Mapped[int] = mapped_column(Integer, default=1)
    posled: Mapped[int] = mapped_column(Integer, default=999)

    articles: Mapped[list["BlogArticle"]] = relationship(back_populates="category")


class BlogArticle(Base):
    __tablename__ = "blog"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("blog_categories.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    alias: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    small: Mapped[str | None] = mapped_column(Text, nullable=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[str | None] = mapped_column(Date, nullable=True)
    images: Mapped[str | None] = mapped_column(Text, nullable=True)
    count_view: Mapped[int] = mapped_column(Integer, default=0)
    read_time: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[str] = mapped_column(String(500), default="")
    meta_title: Mapped[str] = mapped_column(String(255), default="")
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    seo_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    seo_noindex: Mapped[bool] = mapped_column(default=False)
    vis: Mapped[int] = mapped_column(Integer, default=1)
    posled: Mapped[int] = mapped_column(Integer, default=999)

    category: Mapped[BlogCategory | None] = relationship(back_populates="articles")

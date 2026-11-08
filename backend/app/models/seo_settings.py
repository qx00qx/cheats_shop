from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SeoSettings(Base):
    __tablename__ = "seo_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    site_name: Mapped[str] = mapped_column(String(100), default="MILLEX")
    home_title: Mapped[str] = mapped_column(String(255), default="")
    home_description: Mapped[str] = mapped_column(Text, default="")
    default_description: Mapped[str] = mapped_column(
        Text,
        default="Каталог игрового софта MILLEX: читы и инструменты для популярных игр. Изучите описание, возможности и доступные предложения.",
    )
    default_image: Mapped[str] = mapped_column(String(2000), default="")

from urllib.parse import quote, urlsplit
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database import get_db
from app.models.blog import BlogArticle
from app.models.seo_settings import SeoSettings
from app.models.seo_page import SeoPage

router = APIRouter()
SITE_URL = "https://millex.market"
DEFAULT_DESCRIPTION = (
    "Каталог игрового софта MILLEX: читы и инструменты для популярных игр. "
    "Изучите описание, возможности и доступные предложения."
)
SEO_PAGES = {
    "home": {"path": "/", "label": "Главная"},
    "catalog": {"path": "/catalog", "label": "Каталог"},
    "accounts": {"path": "/accounts", "label": "Аккаунты"},
    "blog": {"path": "/blog", "label": "Блог"},
    "privacy": {"path": "/privacy", "label": "Политика конфиденциальности"},
    "cookie": {"path": "/cookie", "label": "Политика cookie"},
    "user-agreement": {"path": "/user-agreement", "label": "Пользовательское соглашение"},
}


class SeoSettingsInput(BaseModel):
    site_name: str = Field(..., min_length=1, max_length=100)
    home_title: str = Field(default="", max_length=255)
    home_description: str = Field(default="", max_length=500)
    default_description: str = Field(..., min_length=1, max_length=500)
    default_image: str = Field(default="", max_length=2000)

    @field_validator(
        "site_name",
        "home_title",
        "home_description",
        "default_description",
        mode="before",
    )
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("default_image")
    @classmethod
    def validate_default_image(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            return ""
        if normalized.startswith("/") and not normalized.startswith("//"):
            return normalized
        parsed = urlsplit(normalized)
        if parsed.scheme in {"https", "http"} and parsed.netloc:
            return normalized
        raise ValueError("Укажите HTTP(S)-ссылку или путь к изображению на сайте")


class SeoPageInput(BaseModel):
    title: str = Field(default="", max_length=255)
    description: str = Field(default="", max_length=500)
    h1: str = Field(default="", max_length=255)
    seo_text: str = Field(default="", max_length=20000)
    image: str = Field(default="", max_length=2000)
    noindex: bool = False

    @field_validator("title", "description", "h1", "seo_text", mode="before")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("image")
    @classmethod
    def validate_image(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            return ""
        if normalized.startswith("/") and not normalized.startswith("//"):
            return normalized
        parsed = urlsplit(normalized)
        if parsed.scheme in {"https", "http"} and parsed.netloc:
            return normalized
        raise ValueError("Укажите HTTP(S)-ссылку или путь к изображению на сайте")


def _serialize_page(page_key: str, page: SeoPage | None) -> dict:
    definition = SEO_PAGES[page_key]
    return {
        "key": page_key,
        "path": definition["path"],
        "label": definition["label"],
        "title": page.title if page else "",
        "description": page.description if page else "",
        "h1": page.h1 if page else "",
        "seo_text": page.seo_text if page else "",
        "image": page.image if page else "",
        "noindex": bool(page.noindex) if page else False,
    }


def _serialize_settings(settings: SeoSettings | None) -> dict[str, str]:
    if settings is None:
        return {
            "site_name": "MILLEX",
            "home_title": "",
            "home_description": "",
            "default_description": DEFAULT_DESCRIPTION,
            "default_image": "",
        }
    return {
        "site_name": settings.site_name,
        "home_title": settings.home_title,
        "home_description": settings.home_description,
        "default_description": settings.default_description,
        "default_image": settings.default_image,
    }


@router.get("/api/seo/settings")
def get_public_seo_settings(db: Session = Depends(get_db)):
    return _serialize_settings(db.get(SeoSettings, 1))


@router.get("/api/admin/seo/settings")
def get_admin_seo_settings(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
):
    return _serialize_settings(db.get(SeoSettings, 1))


@router.put("/api/admin/seo/settings")
def update_admin_seo_settings(
    payload: SeoSettingsInput,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
):
    settings = db.get(SeoSettings, 1)
    if settings is None:
        settings = SeoSettings(id=1)
        db.add(settings)

    for field, value in payload.model_dump().items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return _serialize_settings(settings)


@router.get("/api/seo/pages/{page_key}")
def get_public_seo_page(page_key: str, db: Session = Depends(get_db)):
    if page_key not in SEO_PAGES:
        raise HTTPException(status_code=404, detail="SEO page not found")
    return _serialize_page(page_key, db.get(SeoPage, page_key))


@router.get("/api/admin/seo/pages")
def list_admin_seo_pages(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
):
    stored_pages = {
        page.page_key: page
        for page in db.query(SeoPage).filter(SeoPage.page_key.in_(SEO_PAGES)).all()
    }
    return [
        _serialize_page(page_key, stored_pages.get(page_key))
        for page_key in SEO_PAGES
    ]


@router.put("/api/admin/seo/pages/{page_key}")
def update_admin_seo_page(
    page_key: str,
    payload: SeoPageInput,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
):
    if page_key not in SEO_PAGES:
        raise HTTPException(status_code=404, detail="SEO page not found")
    page = db.get(SeoPage, page_key)
    if page is None:
        page = SeoPage(page_key=page_key)
        db.add(page)
    for field, value in payload.model_dump().items():
        setattr(page, field, value)
    db.commit()
    db.refresh(page)
    return _serialize_page(page_key, page)


def _sitemap_url(path: str, lastmod: str | None = None) -> str:
    loc = escape(f"{SITE_URL}{path}")
    lastmod_tag = f"<lastmod>{escape(lastmod)}</lastmod>" if lastmod else ""
    return f"<url><loc>{loc}</loc>{lastmod_tag}</url>"


@router.get("/sitemap.xml", include_in_schema=False)
def get_sitemap(db: Session = Depends(get_db)) -> Response:
    configured_pages = {
        page.page_key: page
        for page in db.query(SeoPage).filter(SeoPage.page_key.in_(SEO_PAGES)).all()
    }
    urls = [
        _sitemap_url(definition["path"])
        for page_key, definition in SEO_PAGES.items()
        if not configured_pages.get(page_key) or not configured_pages[page_key].noindex
    ]

    categories = db.execute(text("""
        SELECT DISTINCT alias
        FROM categories
        WHERE vis = 1
          AND parent = 0
          AND COALESCE(seo_noindex, FALSE) = FALSE
          AND alias IS NOT NULL
          AND alias <> ''
    """)).scalars()
    urls.extend(
        _sitemap_url(f"/catalog/{quote(alias, safe='-_.~')}")
        for alias in categories
    )

    items = db.execute(text("""
        SELECT DISTINCT alias
        FROM items
        WHERE status = 1
          AND COALESCE(vis, 1) = 1
          AND COALESCE(seo_noindex, FALSE) = FALSE
          AND alias IS NOT NULL
          AND alias <> ''
    """)).scalars()
    urls.extend(
        _sitemap_url(f"/item/{quote(alias, safe='-_.~')}")
        for alias in items
    )

    articles = (
        db.query(BlogArticle.alias, BlogArticle.date)
        .filter(BlogArticle.vis == 1, BlogArticle.seo_noindex.is_(False))
        .all()
    )
    urls.extend(
        _sitemap_url(
            f"/blog/{quote(alias, safe='-_.~')}",
            published_at.isoformat() if published_at else None,
        )
        for alias, published_at in articles
    )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(urls)
        + "</urlset>"
    )
    return Response(
        content=xml,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=300, s-maxage=1800"},
    )

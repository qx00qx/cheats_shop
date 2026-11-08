import html
import re
from datetime import date
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.database import get_db
from app.models.blog import BlogArticle, BlogCategory
from app.schemas.blog import BlogArticleListItem, BlogArticleOut, BlogCategoryOut

router = APIRouter(prefix="/api/blog", tags=["blog"])

RUSSIAN_TRANSLITERATION = str.maketrans({
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e",
    "ё": "yo", "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k",
    "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "",
    "э": "e", "ю": "yu", "я": "ya",
})


class BlogArticleInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    text: str = Field(..., min_length=1, max_length=1_000_000)
    vis: int | None = Field(default=None, ge=0, le=1)
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)
    seo_image: str | None = Field(default=None, max_length=2000)
    seo_noindex: bool = False

    @field_validator("seo_image")
    @classmethod
    def validate_seo_image(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = value.strip()
        if normalized.startswith("/") and not normalized.startswith("//"):
            return normalized
        parsed = urlsplit(normalized)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return normalized
        raise ValueError("Укажите HTTP(S)-ссылку или путь к изображению на сайте")


class BlogArticleVisibilityInput(BaseModel):
    vis: int = Field(..., ge=0, le=1)


def _article_alias(name: str) -> str:
    normalized = name.strip().lower().translate(RUSSIAN_TRANSLITERATION)
    alias = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return alias[:255].rstrip("-") or "article"


def _unique_article_alias(db: Session, name: str, article_id: int | None = None) -> str:
    base_alias = _article_alias(name)
    alias = base_alias
    suffix = 2
    while True:
        query = db.query(BlogArticle.id).filter(BlogArticle.alias == alias)
        if article_id is not None:
            query = query.filter(BlogArticle.id != article_id)
        if query.first() is None:
            return alias
        suffix_text = f"-{suffix}"
        alias = f"{base_alias[:255 - len(suffix_text)]}{suffix_text}"
        suffix += 1


def _article_plain_text(content: str) -> str:
    plain_text = html.unescape(re.sub(r"<[^>]*>", " ", content))
    return re.sub(r"\s+", " ", plain_text).strip()


def _article_excerpt(content: str) -> str:
    return _article_plain_text(content)[:300]


def _serialize_admin_article(article: BlogArticle) -> dict:
    return {
        "id": article.id,
        "alias": article.alias,
        "name": article.name,
        "text": article.text or "",
        "vis": article.vis,
        "date": article.date.isoformat() if article.date else None,
        "seo_title": article.meta_title or "",
        "seo_description": article.meta_description or "",
        "seo_image": article.seo_image or "",
        "seo_noindex": article.seo_noindex,
    }


def serialize_article(article: BlogArticle) -> BlogArticleListItem:
    category = article.category
    date_value = article.date.isoformat() if article.date else None
    return BlogArticleListItem(
        id=article.id,
        alias=article.alias,
        name=article.name,
        excerpt=article.small or "",
        category_id=article.category_id,
        category_alias=category.alias if category else "",
        category_name=category.name if category else "",
        cover_url=article.images or None,
        created_at=date_value,
        published_at=date_value,
    )


@router.get("/admin/articles")
def list_admin_blog_articles(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
):
    articles = db.query(BlogArticle).order_by(BlogArticle.id.desc()).all()
    return [_serialize_admin_article(article) for article in articles]


@router.post("/admin/articles", status_code=201)
def create_admin_blog_article(
    payload: BlogArticleInput,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
):
    name = payload.name.strip()
    content = payload.text.strip()
    plain_text = _article_plain_text(content)
    excerpt = _article_excerpt(content)
    if not name or not plain_text:
        raise HTTPException(status_code=422, detail="Укажите название и текст статьи")

    article = BlogArticle(
        name=name,
        alias=_unique_article_alias(db, name),
        text=content,
        small=excerpt,
        date=date.today(),
        vis=1,
        read_time=max(1, (len(plain_text.split()) + 199) // 200),
        meta_title=payload.seo_title.strip() if payload.seo_title else name,
        meta_description=(
            payload.seo_description.strip()
            if payload.seo_description is not None
            else excerpt
        ),
        seo_image=payload.seo_image,
        seo_noindex=payload.seo_noindex,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return _serialize_admin_article(article)


@router.put("/admin/articles/{article_id}")
def update_admin_blog_article(
    article_id: int,
    payload: BlogArticleInput,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
):
    article = db.get(BlogArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Статья не найдена")

    name = payload.name.strip()
    content = payload.text.strip()
    plain_text = _article_plain_text(content)
    excerpt = _article_excerpt(content)
    if not name or not plain_text:
        raise HTTPException(status_code=422, detail="Укажите название и текст статьи")

    article.name = name
    article.text = content
    article.small = excerpt
    article.read_time = max(1, (len(plain_text.split()) + 199) // 200)
    if "seo_title" in payload.model_fields_set:
        article.meta_title = (payload.seo_title or "").strip()
    elif "text" in payload.model_fields_set or "name" in payload.model_fields_set:
        article.meta_title = name
    if "seo_description" in payload.model_fields_set:
        article.meta_description = (payload.seo_description or "").strip()
    elif "text" in payload.model_fields_set or "name" in payload.model_fields_set:
        article.meta_description = excerpt
    if "seo_image" in payload.model_fields_set:
        article.seo_image = payload.seo_image
    if "seo_noindex" in payload.model_fields_set:
        article.seo_noindex = payload.seo_noindex
    if payload.vis is not None:
        article.vis = payload.vis
    db.commit()
    db.refresh(article)
    return _serialize_admin_article(article)


@router.patch("/admin/articles/{article_id}/visibility")
def update_admin_blog_article_visibility(
    article_id: int,
    payload: BlogArticleVisibilityInput,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
):
    article = db.get(BlogArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Статья не найдена")

    article.vis = payload.vis
    db.commit()
    return {"id": article.id, "vis": article.vis}


@router.get("", response_model=list[BlogArticleListItem])
def list_blog_articles(db: Session = Depends(get_db)):
    articles = (
        db.query(BlogArticle)
        .filter(BlogArticle.vis == 1)
        .order_by(BlogArticle.id.desc())
        .all()
    )
    return [serialize_article(article) for article in articles]


@router.get("/categories", response_model=list[BlogCategoryOut])
def list_blog_categories(db: Session = Depends(get_db)):
    categories = (
        db.query(BlogCategory)
        .filter(BlogCategory.vis == 1)
        .order_by(BlogCategory.posled.asc(), BlogCategory.id.asc())
        .all()
    )
    return categories


@router.get("/{slug}", response_model=BlogArticleOut)
def get_blog_article(slug: str, db: Session = Depends(get_db)):
    article = db.query(BlogArticle).filter(BlogArticle.alias == slug, BlogArticle.vis == 1).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    category = article.category
    date_value = article.date.isoformat() if article.date else None

    return BlogArticleOut(
        id=article.id,
        alias=article.alias,
        name=article.name,
        excerpt=article.small or "",
        category_id=article.category_id,
        category_alias=category.alias if category else "",
        category_name=category.name if category else "",
        cover_url=article.images or None,
        created_at=date_value,
        published_at=date_value,
        content=article.text or "",
        updated_at=None,
        seo_title=article.meta_title or None,
        seo_description=article.meta_description,
        seo_image=article.seo_image,
        seo_noindex=article.seo_noindex,
    )

from urllib.parse import quote
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.blog import BlogArticle

router = APIRouter()
SITE_URL = "https://millex.market"


def _sitemap_url(path: str, lastmod: str | None = None) -> str:
    loc = escape(f"{SITE_URL}{path}")
    lastmod_tag = f"<lastmod>{escape(lastmod)}</lastmod>" if lastmod else ""
    return f"<url><loc>{loc}</loc>{lastmod_tag}</url>"


@router.get("/sitemap.xml", include_in_schema=False)
def get_sitemap(db: Session = Depends(get_db)) -> Response:
    urls = [
        _sitemap_url("/"),
        _sitemap_url("/catalog"),
        _sitemap_url("/accounts"),
        _sitemap_url("/blog"),
        _sitemap_url("/privacy"),
        _sitemap_url("/cookie"),
    ]

    categories = db.execute(text("""
        SELECT DISTINCT alias
        FROM categories
        WHERE vis = 1
          AND parent = 0
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
          AND alias IS NOT NULL
          AND alias <> ''
    """)).scalars()
    urls.extend(
        _sitemap_url(f"/item/{quote(alias, safe='-_.~')}")
        for alias in items
    )

    articles = (
        db.query(BlogArticle.alias, BlogArticle.date)
        .filter(BlogArticle.vis == 1)
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

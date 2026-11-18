from pydantic import BaseModel


class BlogCategoryOut(BaseModel):
    id: int
    alias: str
    name: str

    class Config:
        from_attributes = True


class BlogArticleListItem(BaseModel):
    id: int
    alias: str
    name: str
    excerpt: str
    category_id: int | None = None
    category_alias: str = ""
    category_name: str = ""
    cover_url: str | None = None
    created_at: str | None = None
    published_at: str | None = None

    class Config:
        from_attributes = True


class BlogArticleOut(BlogArticleListItem):
    content: str = ""
    updated_at: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    seo_h1: str | None = None
    seo_text: str | None = None
    seo_image: str | None = None
    seo_noindex: bool = False

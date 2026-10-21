from pydantic import BaseModel


class GameOut(BaseModel):
    id: int
    slug: str
    title: str
    cover_url: str | None = None

    class Config:
        from_attributes = True


class CategoryOut(BaseModel):
    id: int
    slug: str
    title: str

    class Config:
        from_attributes = True
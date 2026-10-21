from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models.blog import BlogArticle, BlogCategory

SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_function():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.query(BlogArticle).delete()
    db.query(BlogCategory).delete()

    category = BlogCategory(id=1, name="Общие", alias="general", vis=1, posled=1)
    db.add(category)
    db.commit()

    article = BlogArticle(
        id=1,
        category_id=1,
        name="Тестовая статья",
        alias="test-article",
        small="Краткое описание",
        text="Полный текст статьи",
        date="2026-10-10",
        images="",
        count_view=1,
        read_time=2,
        tags="тест, статья",
        meta_title="Тестовая статья",
        meta_description="Описание тестовой статьи",
        vis=1,
        posled=1,
    )
    db.add(article)
    db.commit()
    db.close()

    app.dependency_overrides[get_db] = lambda: iter([TestingSessionLocal()])


def test_blog_endpoints():
    client = TestClient(app)

    response = client.get("/api/blog")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["name"] == "Тестовая статья"
    assert payload[0]["category_alias"] == "general"

    detail = client.get("/api/blog/test-article")
    assert detail.status_code == 200
    data = detail.json()
    assert data["content"] == "Полный текст статьи"
    assert data["category_name"] == "Общие"

    categories = client.get("/api/blog/categories")
    assert categories.status_code == 200
    assert categories.json()[0]["alias"] == "general"

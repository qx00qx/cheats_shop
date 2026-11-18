from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin
from app.database import Base, get_db
from app.main import app


def test_admin_can_create_and_edit_blog_articles():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_admin] = lambda: SimpleNamespace(id=91)
    client = TestClient(app)
    try:
        created = client.post(
            "/api/blog/admin/articles",
            json={
                "name": "Новая статья",
                "text": "<h2>Заголовок</h2><p>Текст статьи</p>",
                "seo_title": "Индивидуальный заголовок",
                "seo_description": "Индивидуальное описание",
                "seo_h1": "Отдельный H1 статьи",
                "seo_text": "<p>Дополнительный SEO-текст</p>",
                "seo_image": "/uploads/article.jpg",
                "seo_noindex": True,
            },
        )

        assert created.status_code == 201
        article = created.json()
        assert article["alias"] == "novaya-statya"
        assert article["name"] == "Новая статья"
        assert article["vis"] == 1
        assert article["seo_title"] == "Индивидуальный заголовок"
        assert article["seo_description"] == "Индивидуальное описание"
        assert article["seo_h1"] == "Отдельный H1 статьи"
        assert article["seo_text"] == "<p>Дополнительный SEO-текст</p>"
        assert article["seo_image"] == "/uploads/article.jpg"
        assert article["seo_noindex"] is True

        updated = client.put(
            f"/api/blog/admin/articles/{article['id']}",
            json={
                "name": "Обновлённая статья",
                "text": "<p>Новый текст</p>",
                "seo_title": "Новое SEO",
                "seo_description": "Новое описание",
                "seo_h1": "Обновлённый H1",
                "seo_text": "<p>Обновлённый SEO-текст</p>",
                "seo_image": "https://millex.market/uploads/new-article.jpg",
                "seo_noindex": False,
            },
        )
        assert updated.status_code == 200
        assert updated.json()["alias"] == "novaya-statya"
        assert updated.json()["name"] == "Обновлённая статья"
        assert updated.json()["seo_title"] == "Новое SEO"
        assert updated.json()["seo_h1"] == "Обновлённый H1"
        assert updated.json()["seo_text"] == "<p>Обновлённый SEO-текст</p>"
        assert updated.json()["seo_image"] == "https://millex.market/uploads/new-article.jpg"
        assert updated.json()["seo_noindex"] is False

        public_article = client.get(f"/api/blog/{article['alias']}")
        assert public_article.status_code == 200
        assert public_article.json()["content"] == "<p>Новый текст</p>"
        assert public_article.json()["seo_title"] == "Новое SEO"
        assert public_article.json()["seo_h1"] == "Обновлённый H1"
        assert public_article.json()["seo_text"] == "<p>Обновлённый SEO-текст</p>"
        assert public_article.json()["seo_image"] == "https://millex.market/uploads/new-article.jpg"
        assert public_article.json()["seo_noindex"] is False

        hidden = client.put(
            f"/api/blog/admin/articles/{article['id']}",
            json={
                "name": article["name"],
                "text": article["text"],
                "vis": 0,
            },
        )
        assert hidden.status_code == 200
        assert hidden.json()["vis"] == 0
        assert client.get(f"/api/blog/{article['alias']}").status_code == 404
        assert client.get("/api/blog").json() == []

        articles = client.get("/api/blog/admin/articles")
        assert articles.status_code == 200
        assert len(articles.json()) == 1
        assert articles.json()[0]["vis"] == 0

        republished = client.put(
            f"/api/blog/admin/articles/{article['id']}",
            json={
                "name": article["name"],
                "text": article["text"],
                "vis": 1,
            },
        )
        assert republished.status_code == 200
        assert republished.json()["vis"] == 1
        assert client.get(f"/api/blog/{article['alias']}").status_code == 200
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

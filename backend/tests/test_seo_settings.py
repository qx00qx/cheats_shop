from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin
from app.database import Base, get_db
from app.main import app
from app.models.seo_page import SeoPage


def test_admin_can_update_public_seo_settings():
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
        initial = client.get("/api/seo/settings")
        assert initial.status_code == 200
        assert initial.json()["site_name"] == "MILLEX"

        updated = client.put(
            "/api/admin/seo/settings",
            json={
                "site_name": "Millex Market",
                "home_title": "Главная магазина",
                "home_description": "Описание главной.",
                "default_description": "Описание сайта по умолчанию.",
                "default_image": "/uploads/seo-preview.jpg",
            },
        )
        assert updated.status_code == 200
        assert updated.json()["home_title"] == "Главная магазина"

        public_settings = client.get("/api/seo/settings")
        assert public_settings.status_code == 200
        assert public_settings.json()["site_name"] == "Millex Market"
        assert public_settings.json()["default_image"] == "/uploads/seo-preview.jpg"

        invalid_image = client.put(
            "/api/admin/seo/settings",
            json={
                "site_name": "Millex Market",
                "home_title": "",
                "home_description": "",
                "default_description": "Описание сайта по умолчанию.",
                "default_image": "javascript:alert(1)",
            },
        )
        assert invalid_image.status_code == 422
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_admin_can_set_page_seo_and_sitemap_excludes_noindex_pages():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS categories")
        connection.exec_driver_sql("DROP TABLE IF EXISTS items")
        connection.exec_driver_sql("""
            CREATE TABLE categories (
                id INTEGER PRIMARY KEY,
                alias TEXT,
                vis INTEGER,
                parent INTEGER,
                seo_noindex BOOLEAN
            )
        """)
        connection.exec_driver_sql("""
            CREATE TABLE items (
                id INTEGER PRIMARY KEY,
                alias TEXT,
                status INTEGER,
                vis INTEGER,
                seo_noindex BOOLEAN
            )
        """)
        connection.exec_driver_sql("""
            INSERT INTO categories (id, alias, vis, parent, seo_noindex)
            VALUES (1, 'hidden-game', 1, 0, 1)
        """)
        connection.exec_driver_sql("""
            INSERT INTO items (id, alias, status, vis, seo_noindex)
            VALUES (1, 'public-item', 1, 1, 0), (2, 'hidden-item', 1, 1, 1)
        """)
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
        updated = client.put(
            "/api/admin/seo/pages/home",
            json={
                "title": "Главная магазина",
                "description": "SEO описание главной",
                "image": "/uploads/home.jpg",
                "noindex": True,
            },
        )
        assert updated.status_code == 200
        assert updated.json()["title"] == "Главная магазина"
        assert updated.json()["noindex"] is True

        public = client.get("/api/seo/pages/home")
        assert public.status_code == 200
        assert public.json()["image"] == "/uploads/home.jpg"
        assert public.json()["noindex"] is True

        sitemap = client.get("/sitemap.xml")
        assert sitemap.status_code == 200
        assert "<loc>https://millex.market/</loc>" not in sitemap.text
        assert "hidden-game" not in sitemap.text
        assert "public-item" in sitemap.text
        assert "hidden-item" not in sitemap.text
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

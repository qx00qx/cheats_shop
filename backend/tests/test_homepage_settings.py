from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin
from app.api.routes import homepage as homepage_route
from app.database import Base, get_db
from app.main import app
from app.models import HomepageSetting


def make_homepage_client(monkeypatch, tmp_path):
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
    app.dependency_overrides[get_current_admin] = lambda: SimpleNamespace(
        id=1,
        is_admin=True,
    )
    monkeypatch.setattr(homepage_route, "HOMEPAGE_UPLOAD_DIR", tmp_path)
    return engine, session_factory, TestClient(app), previous


def test_admin_upload_persists_background_and_public_endpoint_returns_it(monkeypatch, tmp_path):
    engine, session_factory, client, previous = make_homepage_client(monkeypatch, tmp_path)
    try:
        content = b"\x89PNG\r\n\x1a\nhomepage-image"
        response = client.put(
            "/api/admin/homepage/telegram-card",
            files={"image": ("banner.png", content, "image/png")},
        )

        assert response.status_code == 200
        background_url = response.json()["background_url"]
        assert background_url.startswith("/uploads/homepage/")
        uploaded_file = tmp_path / background_url.rsplit("/", 1)[1]
        assert uploaded_file.read_bytes() == content

        with session_factory() as db:
            setting = db.get(HomepageSetting, 1)
            assert setting.telegram_card_background_url == background_url

        public_response = client.get("/api/homepage/telegram-card")
        assert public_response.status_code == 200
        assert public_response.json() == {"background_url": background_url}
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_admin_upload_rejects_non_image_content(monkeypatch, tmp_path):
    engine, _, client, previous = make_homepage_client(monkeypatch, tmp_path)
    try:
        response = client.put(
            "/api/admin/homepage/telegram-card",
            files={"image": ("banner.png", b"not an image", "image/png")},
        )

        assert response.status_code == 415
        assert not list(tmp_path.iterdir())
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_admin_upload_rejects_oversized_image(monkeypatch, tmp_path):
    engine, _, client, previous = make_homepage_client(monkeypatch, tmp_path)
    try:
        response = client.put(
            "/api/admin/homepage/telegram-card",
            files={
                "image": (
                    "banner.png",
                    b"\x89PNG\r\n\x1a\n" + b"x" * homepage_route.MAX_IMAGE_SIZE,
                    "image/png",
                )
            },
        )

        assert response.status_code == 413
        assert not list(tmp_path.iterdir())
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_homepage_background_upload_requires_admin(monkeypatch, tmp_path):
    engine, _, client, previous = make_homepage_client(monkeypatch, tmp_path)
    try:
        app.dependency_overrides.pop(get_current_admin, None)
        response = client.put(
            "/api/admin/homepage/telegram-card",
            files={"image": ("banner.png", b"\x89PNG\r\n\x1a\nimage", "image/png")},
        )

        assert response.status_code == 401
        assert not list(tmp_path.iterdir())
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

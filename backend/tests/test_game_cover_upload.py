from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin
from app.api.routes import uploads as uploads_route
from app.database import Base, get_db
from app.main import app


def make_game_cover_client(monkeypatch, tmp_path):
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
    monkeypatch.setattr(uploads_route, "GAME_COVER_UPLOAD_DIR", tmp_path)
    return engine, TestClient(app), previous


def test_game_cover_upload_saves_valid_image(monkeypatch, tmp_path):
    engine, client, previous = make_game_cover_client(monkeypatch, tmp_path)
    try:
        content = b"\x89PNG\r\n\x1a\ncover-image"
        response = client.post(
            "/api/admin/uploads/images/game-covers",
            files={"image": ("cover.png", content, "image/png")},
        )

        assert response.status_code == 200
        uploaded = response.json()
        assert uploaded["url"].startswith("/uploads/game-covers/")
        assert uploaded["size"] == len(content)
        assert (tmp_path / uploaded["url"].rsplit("/", 1)[1]).read_bytes() == content
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_game_cover_upload_rejects_non_image_and_oversized_files(monkeypatch, tmp_path):
    engine, client, previous = make_game_cover_client(monkeypatch, tmp_path)
    try:
        invalid_response = client.post(
            "/api/admin/uploads/images/game-covers",
            files={"image": ("cover.png", b"not an image", "image/png")},
        )
        assert invalid_response.status_code == 415

        oversized_response = client.post(
            "/api/admin/uploads/images/game-covers",
            files={
                "image": (
                    "cover.png",
                    b"\x89PNG\r\n\x1a\n" + b"x" * uploads_route.MAX_IMAGE_SIZE,
                    "image/png",
                )
            },
        )
        assert oversized_response.status_code == 413
        assert not list(tmp_path.iterdir())
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_game_cover_upload_requires_admin(monkeypatch, tmp_path):
    engine, client, previous = make_game_cover_client(monkeypatch, tmp_path)
    try:
        app.dependency_overrides.pop(get_current_admin, None)
        response = client.post(
            "/api/admin/uploads/images/game-covers",
            files={"image": ("cover.png", b"\x89PNG\r\n\x1a\nimage", "image/png")},
        )
        assert response.status_code == 401
        assert not list(tmp_path.iterdir())
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

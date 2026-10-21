import json
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin
from app.database import Base, get_db
from app.main import app


def make_status_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE items (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                alias TEXT NOT NULL,
                status INTEGER NOT NULL,
                vis INTEGER NOT NULL,
                security_status INTEGER NOT NULL,
                undetected INTEGER NOT NULL DEFAULT 0,
                "categoryData" TEXT NOT NULL
            )
        """))
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    return engine, session_factory, TestClient(app), previous


def test_public_statuses_returns_visible_active_items_grouped_by_game():
    engine, _, client, previous = make_status_client()
    category_data = json.dumps({"id": 7, "name": "CS2"})
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                INSERT INTO items (id, name, alias, status, vis, security_status, "categoryData")
                VALUES
                    (1, 'CS2 Active', 'cs2-active', 1, 1, 1, :category_data),
                    (2, 'CS2 Risk', 'cs2-risk', 1, 1, 3, :category_data),
                    (3, 'Hidden Cheat', 'hidden', 1, 0, 1, :category_data),
                    (4, 'Inactive Cheat', 'inactive', 0, 1, 1, :category_data)
            """), {"category_data": category_data})

        response = client.get("/api/catalog/statuses")

        assert response.status_code == 200
        assert response.json() == {
            "games": [{
                "id": "7",
                "name": "CS2",
                "cheats": [
                    {"id": "1", "alias": "cs2-active", "name": "CS2 Active", "status": 1},
                    {"id": "2", "alias": "cs2-risk", "name": "CS2 Risk", "status": 3},
                ],
            }]
        }
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_public_statuses_ignores_invalid_game_metadata():
    engine, _, client, previous = make_status_client()
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                INSERT INTO items (id, name, alias, status, vis, security_status, "categoryData")
                VALUES (1, 'Uncategorized Cheat', 'uncategorized', 1, 1, 2, 'invalid')
            """))

        response = client.get("/api/catalog/statuses")

        assert response.status_code == 200
        assert response.json() == {"games": []}
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_admin_can_update_item_security_status_and_undetected_flag():
    engine, _, client, previous = make_status_client()
    app.dependency_overrides[get_current_admin] = lambda: SimpleNamespace(id=91)
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                INSERT INTO items (id, name, alias, status, vis, security_status, "categoryData")
                VALUES (1, 'Test Cheat', 'test-cheat', 1, 1, 2, '{}')
            """))

        response = client.patch(
            "/api/catalog/admin/items/1/security-status",
            json={"security_status": 1},
        )

        assert response.status_code == 200
        assert response.json() == {"id": 1, "security_status": 1}
        with engine.connect() as connection:
            row = connection.execute(text(
                "SELECT security_status, undetected FROM items WHERE id = 1"
            )).one()
            assert tuple(row) == (1, 1)

        invalid_status = client.patch(
            "/api/catalog/admin/items/1/security-status",
            json={"security_status": 4},
        )
        assert invalid_status.status_code == 422

        missing_item = client.patch(
            "/api/catalog/admin/items/999/security-status",
            json={"security_status": 3},
        )
        assert missing_item.status_code == 404
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

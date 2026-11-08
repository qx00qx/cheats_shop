import json

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import CheatFeatureAssignment, CheatFeatureCategory


def make_similar_items_client():
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
                price NUMERIC,
                preview TEXT,
                video TEXT,
                gallery TEXT
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


def test_similar_items_returns_only_ranked_feature_matches():
    engine, session_factory, client, previous = make_similar_items_client()
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                INSERT INTO items (id, name, alias, status, vis, price, preview)
                VALUES
                    (1, 'Current', 'current', 1, 1, 100, '/current.jpg'),
                    (2, 'One match', 'one-match', 1, 1, 200, '/one.jpg'),
                    (3, 'Two matches', 'two-matches', 1, 1, 300, '/two.jpg'),
                    (4, 'No matching feature', 'no-match', 1, 1, 400, '/none.jpg'),
                    (5, 'Hidden', 'hidden', 1, 0, 500, '/hidden.jpg')
            """))

        with session_factory() as db:
            aim = CheatFeatureCategory(title="Aim")
            visual = CheatFeatureCategory(title="Visual")
            db.add_all([aim, visual])
            db.flush()
            db.add_all([
                CheatFeatureAssignment(
                    item_id=1,
                    category_id=aim.id,
                    features=json.dumps(["Aimbot"]),
                ),
                CheatFeatureAssignment(
                    item_id=1,
                    category_id=visual.id,
                    features=json.dumps(["ESP"]),
                ),
                CheatFeatureAssignment(
                    item_id=2,
                    category_id=visual.id,
                    features=json.dumps([" esp "]),
                ),
                CheatFeatureAssignment(
                    item_id=3,
                    category_id=aim.id,
                    features=json.dumps(["Aimbot"]),
                ),
                CheatFeatureAssignment(
                    item_id=3,
                    category_id=visual.id,
                    features=json.dumps(["ESP"]),
                ),
                CheatFeatureAssignment(
                    item_id=4,
                    category_id=aim.id,
                    features=json.dumps(["Other feature"]),
                ),
                CheatFeatureAssignment(
                    item_id=5,
                    category_id=aim.id,
                    features=json.dumps(["Aimbot"]),
                ),
            ])
            db.commit()

        response = client.get("/api/catalog/similar-items/current")

        assert response.status_code == 200
        items = response.json()["items"]
        assert [item["alias"] for item in items] == ["two-matches", "one-match"]
        assert [item["shared_features"] for item in items] == [
            ["Aimbot", "ESP"],
            ["ESP"],
        ]
        assert items[0]["image"] == "/two.jpg"
        assert len(items) <= 12
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_similar_items_fallback_is_limited_and_excludes_hidden_items():
    engine, _, client, previous = make_similar_items_client()
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                INSERT INTO items (id, name, alias, status, vis)
                VALUES (1, 'Current', 'current', 1, 1)
            """))
            connection.execute(text("""
                INSERT INTO items (id, name, alias, status, vis)
                VALUES
            """ + ", ".join(
                f"({item_id}, 'Item {item_id}', 'item-{item_id}', 1, 1)"
                for item_id in range(2, 17)
            )))
            connection.execute(text("""
                INSERT INTO items (id, name, alias, status, vis)
                VALUES (17, 'Hidden', 'hidden', 1, 0), (18, 'Inactive', 'inactive', 0, 1)
            """))

        response = client.get("/api/catalog/similar-items/current")

        assert response.status_code == 200
        items = response.json()["items"]
        assert len(items) == 12
        assert items[0]["id"] == 16
        assert items[-1]["id"] == 5
        assert all(item["shared_features"] == [] for item in items)
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_similar_items_returns_not_found_for_hidden_or_missing_items():
    engine, _, client, previous = make_similar_items_client()
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                INSERT INTO items (id, name, alias, status, vis)
                VALUES (1, 'Hidden', 'hidden', 1, 0)
            """))

        assert client.get("/api/catalog/similar-items/missing").status_code == 404
        assert client.get("/api/catalog/similar-items/hidden").status_code == 404
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

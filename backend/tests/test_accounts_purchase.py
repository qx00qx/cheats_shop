import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.routes import accounts as accounts_route
from app.database import Base, get_db
from app.main import app
from app.models import BotOrder, User


def test_account_purchase_saves_exe_and_supports_authorized_download(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def add_postgres_sequence_functions(connection, _record):
        connection.create_function(
            "pg_get_serial_sequence",
            2,
            lambda *_args: "bot_orders_id_seq",
        )
        connection.create_function("nextval", 1, lambda _sequence: 9001)

    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE accounts (
                id INTEGER PRIMARY KEY,
                name TEXT,
                alias TEXT,
                price NUMERIC,
                meta_data TEXT,
                vis INTEGER
            )
        """))
        connection.execute(text("""
            INSERT INTO accounts (id, name, alias, price, meta_data, vis)
            VALUES (1, 'CS2 Account', 'cs2', 100, :metadata, 1)
        """), {"metadata": json.dumps({"game": "CS2", "stock": 1})})

    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with session_factory() as db:
        user = User(
            email="buyer@example.test",
            username="buyer",
            password_hash="hash",
            balance="500",
        )
        db.add(user)
        db.commit()
        user_id = user.id

    def override_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id)
    original_text = accounts_route.text
    monkeypatch.setattr(
        accounts_route,
        "text",
        lambda statement: original_text(statement.replace(" FOR UPDATE", "")),
    )
    monkeypatch.setattr(accounts_route, "get_promotion_start", lambda _db: None)
    monkeypatch.setattr(
        accounts_route.nfa,
        "get_stock",
        AsyncMock(return_value={"cs2": 1}),
    )
    monkeypatch.setattr(
        accounts_route.nfa,
        "activate_direct",
        AsyncMock(return_value={
            "status": "success",
            "exe_base64": "TVo=",
            "exe_filename": "cs2-account.exe",
        }),
    )

    try:
        with TestClient(app) as client:
            response = client.post("/api/accounts/1/purchase")
            assert response.status_code == 200
            assert response.json()["status"] == "completed"
            order_id = response.json()["order_id"]

            download = client.get(f"/api/accounts/purchases/{order_id}/download")
            assert download.status_code == 200
            assert download.content == b"MZ"
            assert "cs2-account.exe" in download.headers["content-disposition"]

        with session_factory() as db:
            order = db.query(BotOrder).one()
            assert order.status == "completed"
            assert order.delivery_file == b"MZ"
            assert db.get(User, user_id).balance == "405.00"
            metadata = db.execute(text(
                "SELECT meta_data FROM accounts WHERE id = 1"
            )).scalar_one()
            assert json.loads(metadata)["stock"] == 0
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

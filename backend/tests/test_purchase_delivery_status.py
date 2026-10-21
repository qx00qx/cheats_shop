import hashlib

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import BotOrder


def make_delivery_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE items (
                id INTEGER PRIMARY KEY,
                alias TEXT,
                instruction_link TEXT
            )
        """))
        connection.execute(text("""
            INSERT INTO items (id, alias, instruction_link)
            VALUES (1, 'test-product', 'test-install-guide')
        """))

    token = "test-return-token-value-that-is-long-enough"
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with session_factory() as db:
        db.add(BotOrder(
            id=73142,
            external_order_id=73142,
            item_alias="test-product",
            return_token_hash=token_hash,
            product="Test product",
            period="30 дней",
            amount="850.00",
            status="pending_payment",
        ))
        db.commit()

    def override_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    return engine, session_factory, TestClient(app), previous, token


def test_delivery_status_requires_matching_bearer_token_and_hides_unissued_key():
    engine, session_factory, client, previous, token = make_delivery_client()
    try:
        invalid_response = client.get(
            "/api/payments/bot-orders/73142/status",
            headers={
                "X-Order-Access-Token": "wrong-return-token-value-that-is-long"
            },
        )
        assert invalid_response.status_code == 404

        response = client.get(
            "/api/payments/bot-orders/73142/status",
            headers={"X-Order-Access-Token": token},
        )
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["referrer-policy"] == "no-referrer"
        assert response.json() == {
            "order_id": 73142,
            "status": "pending_payment",
            "product": "Test product",
            "period": "30 дней",
            "amount": 850.0,
            "currency": "RUB",
            "key_value": None,
            "instruction_link": "test-install-guide",
        }

        with session_factory() as db:
            order = db.get(BotOrder, 73142)
            order.status = "new"
            order.key_value = "PREMATURE-KEY"
            db.commit()

        awaiting_response = client.get(
            "/api/payments/bot-orders/73142/status",
            headers={"X-Order-Access-Token": token},
        )
        assert awaiting_response.status_code == 200
        assert awaiting_response.json()["key_value"] is None

        with session_factory() as db:
            order = db.get(BotOrder, 73142)
            order.status = "completed"
            order.key_value = "ACTIVATION-KEY"
            db.commit()

        completed_response = client.get(
            "/api/payments/bot-orders/73142/status",
            headers={"X-Order-Access-Token": token},
        )
        assert completed_response.status_code == 200
        assert completed_response.json()["key_value"] == "ACTIVATION-KEY"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

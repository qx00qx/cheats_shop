from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import BotOrder


def make_recent_purchases_client():
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
    return engine, session_factory, TestClient(app), previous


def test_recent_purchases_returns_paid_events_with_masked_email_only():
    engine, session_factory, client, previous = make_recent_purchases_client()
    created_at = datetime.now(timezone.utc) - timedelta(hours=3)
    try:
        with session_factory() as db:
            db.add_all([
                BotOrder(
                    external_order_id=1,
                    item_alias="sample-cheat",
                    product="Sample Cheat",
                    email="mishabelik2012@mail.ru",
                    status="completed",
                    created_at=created_at,
                ),
                BotOrder(
                    external_order_id=2,
                    item_alias="pending-cheat",
                    product="Unpaid Cheat",
                    email="buyer@mail.ru",
                    status="pending_payment",
                    created_at=datetime.now(timezone.utc) - timedelta(minutes=10),
                ),
                BotOrder(
                    external_order_id=3,
                    item_alias="old-cheat",
                    product="Old Cheat",
                    email="buyer@mail.ru",
                    status="completed",
                    created_at=datetime.now(timezone.utc) - timedelta(days=8),
                ),
                BotOrder(
                    external_order_id=4,
                    item_alias="account-type",
                    product="Game Account",
                    period="Аккаунт",
                    email="account-buyer@mail.ru",
                    status="completed",
                    created_at=datetime.now(timezone.utc) - timedelta(hours=1),
                ),
            ])
            db.commit()

        response = client.get("/api/catalog/recent-purchases")

        assert response.status_code == 200
        purchases = response.json()
        assert len(purchases) == 1
        assert purchases[0]["alias"] == "sample-cheat"
        assert purchases[0]["product"] == "Sample Cheat"
        assert purchases[0]["email"] == "mi****@.ru"
        assert "mishabelik2012@mail.ru" not in response.text
        assert datetime.fromisoformat(purchases[0]["created_at"]) == created_at
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_recent_purchases_masks_malformed_emails_by_omitting_the_event():
    engine, session_factory, client, previous = make_recent_purchases_client()
    try:
        with session_factory() as db:
            db.add(BotOrder(
                external_order_id=4,
                item_alias="sample-cheat",
                product="Sample Cheat",
                email="not-an-email",
                status="completed",
            ))
            db.commit()

        response = client.get("/api/catalog/recent-purchases")

        assert response.status_code == 200
        assert response.json() == []
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_recent_purchases_returns_more_than_previous_limit():
    engine, session_factory, client, previous = make_recent_purchases_client()
    created_at = datetime.now(timezone.utc)
    try:
        with session_factory() as db:
            db.add_all([
                BotOrder(
                    external_order_id=index,
                    item_alias=f"sample-cheat-{index}",
                    product=f"Sample Cheat {index}",
                    email=f"buyer{index}@mail.ru",
                    status="completed",
                    created_at=created_at - timedelta(minutes=index),
                )
                for index in range(1, 26)
            ])
            db.commit()

        response = client.get("/api/catalog/recent-purchases")

        assert response.status_code == 200
        assert len(response.json()) == 25
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_item_sales_returns_count_and_recent_masked_sales_for_that_cheat_only():
    engine, session_factory, client, previous = make_recent_purchases_client()
    created_at = datetime.now(timezone.utc) - timedelta(hours=4)
    try:
        with session_factory() as db:
            db.add_all([
                BotOrder(
                    external_order_id=10,
                    item_alias="sample-cheat",
                    product="Sample Cheat",
                    email="buyer.one@mail.ru",
                    status="completed",
                    created_at=created_at,
                ),
                BotOrder(
                    external_order_id=11,
                    item_alias="sample-cheat",
                    product="Sample Cheat",
                    email="buyer.two@mail.ru",
                    status="new",
                    created_at=created_at - timedelta(hours=1),
                ),
                BotOrder(
                    external_order_id=12,
                    item_alias="sample-cheat",
                    product="Sample Cheat",
                    email="unpaid@mail.ru",
                    status="pending_payment",
                    created_at=created_at,
                ),
                BotOrder(
                    external_order_id=13,
                    item_alias="sample-cheat",
                    product="Game Account",
                    period="Аккаунт",
                    email="account@mail.ru",
                    status="completed",
                    created_at=created_at,
                ),
                BotOrder(
                    external_order_id=14,
                    item_alias="another-cheat",
                    product="Another Cheat",
                    email="other@mail.ru",
                    status="completed",
                    created_at=created_at,
                ),
            ])
            db.commit()

        response = client.get("/api/catalog/items/sample-cheat/sales")

        assert response.status_code == 200
        assert response.json() == {
            "purchase_count": 2,
            "sales": [
                {"email": "bu****@.ru", "created_at": created_at.isoformat()},
                {
                    "email": "bu****@.ru",
                    "created_at": (created_at - timedelta(hours=1)).isoformat(),
                },
            ],
        }
        assert "buyer.one@mail.ru" not in response.text
        assert "buyer.two@mail.ru" not in response.text
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

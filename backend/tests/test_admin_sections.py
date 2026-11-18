from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import httpx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin, get_current_user
from app.api.routes.admin import payouts
from app.database import get_db
from app.main import app


@pytest.fixture
def admin_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                email TEXT,
                username TEXT
            )
        """))
        connection.execute(text("""
            CREATE TABLE admin_payouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_user_id INTEGER NOT NULL,
                amount_rub INTEGER NOT NULL,
                card_last4 VARCHAR(4) NOT NULL,
                status VARCHAR(24) NOT NULL,
                idempotency_key VARCHAR(36) NOT NULL UNIQUE,
                provider_transaction_id VARCHAR(128),
                provider_status VARCHAR(64),
                error_message VARCHAR(500),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """))
        connection.execute(text("""
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY,
                status TEXT,
                total NUMERIC,
                payment_method TEXT,
                created_at DATETIME,
                user_id INTEGER,
                promo_code TEXT,
                platega_tx_id TEXT
            )
        """))
        connection.execute(text("""
            CREATE TABLE bot_orders (
                id INTEGER PRIMARY KEY,
                external_order_id INTEGER,
                status TEXT,
                amount NUMERIC,
                payment TEXT,
                created_at DATETIME,
                site_user_id INTEGER,
                email TEXT,
                product TEXT,
                period TEXT,
                game TEXT,
                item_alias TEXT
            )
        """))
        connection.execute(text("""
            CREATE TABLE categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                alias TEXT,
                images_characters TEXT,
                parent INTEGER DEFAULT 0,
                vis INTEGER DEFAULT 1,
                posled INTEGER DEFAULT 999,
                seo_title TEXT,
                seo_description TEXT,
                seo_h1 TEXT,
                seo_text TEXT,
                seo_image TEXT,
                seo_noindex BOOLEAN DEFAULT FALSE
            )
        """))
        connection.execute(text("""
            CREATE TABLE items (
                id INTEGER PRIMARY KEY,
                "categoryData" TEXT,
                status INTEGER,
                vis INTEGER DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 999,
                seo_title TEXT,
                seo_description TEXT,
                seo_h1 TEXT,
                seo_text TEXT,
                seo_image TEXT,
                seo_noindex BOOLEAN DEFAULT FALSE
            )
        """))
        connection.execute(text(
            "INSERT INTO users (id, email, username) VALUES (1, 'admin@example.test', 'admin')"
        ))
        connection.execute(text("""
            INSERT INTO orders (id, status, total, payment_method, created_at, user_id)
            VALUES (10, 'completed', 125, 'card', '2025-01-02 10:00:00', 1)
        """))
        connection.execute(text("""
            INSERT INTO bot_orders (
                id, external_order_id, status, amount, payment, created_at,
                site_user_id, email, product, period, game, item_alias
            ) VALUES (
                20, 200, 'new', 250, 'sbp', '2025-01-03 10:00:00',
                1, 'admin@example.test', 'Test item', '30 days', 'CS2', 'test-item'
            )
        """))
        connection.execute(text("""
            INSERT INTO categories (id, name, alias, images_characters, parent, vis, posled)
            VALUES (1, 'CS2', 'cs2', '/cs2.png', 0, 1, 1)
        """))
        connection.execute(text(
            """INSERT INTO items (id, "categoryData", status)
               VALUES (1, '{"id": 1, "name": "CS2"}', 1)"""
        ))

    def override_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    previous_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_admin] = lambda: SimpleNamespace(id=1)
    client = TestClient(app)
    try:
        yield client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        engine.dispose()


def test_admin_orders_merges_sources_and_filters(admin_client):
    response = admin_client.get("/api/admin/orders")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert {item["source"] for item in payload["items"]} == {"store", "catalog"}
    assert payload["items"][0]["id"] == 200

    filtered = admin_client.get("/api/admin/orders", params={"source": "catalog", "status": "new"})
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["product"] == "Test item"


def test_admin_games_crud_and_soft_hide(admin_client):
    listed = admin_client.get("/api/catalog/admin/games")
    assert listed.status_code == 200
    assert listed.json()[0]["product_count"] == 1

    created = admin_client.post("/api/catalog/admin/games", json={
        "title": "Rust",
        "slug": "rust",
        "cover_url": "",
        "seo_h1": "Читы для Rust",
        "seo_text": "<p>SEO-описание Rust</p>",
        "sort_order": 2,
        "is_active": True,
    })
    assert created.status_code == 201
    assert created.json()["seo_h1"] == "Читы для Rust"
    assert created.json()["seo_text"] == "<p>SEO-описание Rust</p>"
    game_id = created.json()["id"]

    hidden = admin_client.put(f"/api/catalog/admin/games/{game_id}", json={
        "title": "Rust",
        "slug": "rust",
        "cover_url": "",
        "seo_h1": "Актуальные читы Rust",
        "seo_text": "<p>Обновлённое SEO-описание Rust</p>",
        "sort_order": 2,
        "is_active": False,
    })
    assert hidden.status_code == 200
    assert hidden.json()["is_active"] is False
    assert hidden.json()["seo_h1"] == "Актуальные читы Rust"
    assert hidden.json()["seo_text"] == "<p>Обновлённое SEO-описание Rust</p>"


def test_admin_can_hide_and_restore_item_in_catalog(admin_client):
    hidden = admin_client.patch(
        "/api/catalog/admin/items/1/visibility",
        json={"vis": 0},
    )

    assert hidden.status_code == 200
    assert hidden.json() == {"id": 1, "vis": 0}

    restored = admin_client.patch(
        "/api/catalog/admin/items/1/visibility",
        json={"vis": 1},
    )

    assert restored.status_code == 200
    assert restored.json() == {"id": 1, "vis": 1}


def test_admin_payout_is_logged_and_idempotent(admin_client, monkeypatch):
    provider = AsyncMock(return_value={
        "transactionId": "provider-123",
        "status": "PENDING",
    })
    monkeypatch.setattr(payouts, "payout_card_rub", provider)
    payload = {
        "card_number": "1234567890123456",
        "amount_rub": 500,
        "request_id": "123e4567-e89b-12d3-a456-426614174000",
    }

    response = admin_client.post("/api/admin/payouts", json=payload)
    assert response.status_code == 201
    assert response.json()["status"] == "submitted"
    assert response.json()["card_last4"] == "3456"

    repeated = admin_client.post("/api/admin/payouts", json=payload)
    assert repeated.status_code == 201
    assert repeated.json()["id"] == response.json()["id"]
    provider.assert_awaited_once()

    history = admin_client.get("/api/admin/payouts")
    assert history.status_code == 200
    assert len(history.json()["items"]) == 1


def test_ambiguous_payout_response_is_logged_without_automatic_retry(admin_client, monkeypatch):
    provider = AsyncMock(side_effect=httpx.TimeoutException("provider timeout"))
    monkeypatch.setattr(payouts, "payout_card_rub", provider)
    payload = {
        "card_number": "1234567890123456",
        "amount_rub": 500,
        "request_id": "123e4567-e89b-12d3-a456-426614174001",
    }

    response = admin_client.post("/api/admin/payouts", json=payload)
    assert response.status_code == 502
    assert "verify it with Platega" in response.json()["detail"]

    repeated = admin_client.post("/api/admin/payouts", json=payload)
    assert repeated.status_code == 201
    assert repeated.json()["status"] == "unknown"
    provider.assert_awaited_once()


def test_admin_endpoints_reject_non_admin(admin_client):
    app.dependency_overrides.pop(get_current_admin, None)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id=2,
        is_active=True,
        is_admin=False,
    )

    response = admin_client.get("/api/admin/orders")

    assert response.status_code == 403

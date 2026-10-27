from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin
from app.database import Base, get_db
from app.main import app
from app.models import AccountingEntry, BotOrder
from app.services.accounting import (
    record_bot_order_chargeback,
    record_bot_order_sale,
    snapshot_order_accounting,
)


def make_accounting_client():
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
                name TEXT,
                alias TEXT,
                tabs TEXT,
                prices TEXT
            )
        """))
        connection.execute(text("""
            INSERT INTO items (id, name, alias, tabs, prices)
            VALUES (1, 'Test item', 'test-item', '["30 дней"]', '["100"]')
        """))

    def override_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_admin] = lambda: SimpleNamespace(id=1)
    return engine, session_factory, TestClient(app), previous


def test_accounting_settings_costs_expenses_and_report():
    engine, session_factory, client, previous = make_accounting_client()
    try:
        assert client.put(
            "/api/admin/accounting/commission",
            json={"management_commission_percent": 10},
        ).status_code == 200
        assert client.put(
            "/api/admin/accounting/item-cost",
            json={"item_id": 1, "tariff_id": 1, "cost_amount": 40},
        ).status_code == 200

        with session_factory() as db:
            order = BotOrder(
                id=101,
                external_order_id=101,
                item_alias="test-item",
                payment="Platega",
                product="Test item",
                period="30 дней",
                amount=Decimal("100.00"),
                status="new",
                created_at=datetime(2025, 1, 15, tzinfo=timezone.utc),
                **snapshot_order_accounting(db, item_id=1, tariff_id=1),
            )
            db.add(order)
            db.flush()
            record_bot_order_sale(db, order)
            db.commit()

        expense_response = client.post(
            "/api/admin/accounting/expenses",
            json={
                "amount": 5,
                "occurred_at": "2025-01-15T10:00:00Z",
                "category": "hosting",
                "description": "Server costs",
            },
        )
        assert expense_response.status_code == 201

        settings_response = client.get("/api/admin/accounting/settings")
        assert settings_response.status_code == 200
        settings = settings_response.json()
        assert settings["management_commission_percent"] == 10
        assert settings["items"][0]["tariffs"][0]["cost_amount"] == 40

        report_response = client.get(
            "/api/admin/accounting/summary",
            params={"date_from": "2025-01-01", "date_to": "2030-12-31"},
        )
        assert report_response.status_code == 200
        report = report_response.json()
        assert report["totals"]["turnover"] == 100
        assert report["totals"]["sales"] == 100
        assert report["totals"]["costs"] == 40
        assert report["totals"]["commissions"] == 10
        assert report["totals"]["gross_profit"] == 50
        assert report["totals"]["expenses"] == 5
        assert report["totals"]["net_profit"] == 45
        assert len(report["entries"]) == 1
        assert len(report["expenses_list"]) == 1
        with session_factory() as db:
            assert db.query(AccountingEntry).count() == 1
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_accounting_admin_endpoints_reject_non_admin():
    engine, _, client, previous = make_accounting_client()
    try:
        from app.api.deps import get_current_user

        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
            id=2,
            is_admin=False,
        )
        app.dependency_overrides.pop(get_current_admin, None)
        response = client.get("/api/admin/accounting/settings")
        assert response.status_code == 403
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_bot_order_chargeback_reverses_sale_and_is_idempotent():
    engine, session_factory, client, previous = make_accounting_client()
    try:
        with session_factory() as db:
            order = BotOrder(
                id=202,
                external_order_id=202,
                item_alias="test-item",
                payment="Platega",
                amount=Decimal("100.00"),
                accounting_item_id=1,
                accounting_tariff_id=1,
                accounting_cost_amount=Decimal("40.00"),
                accounting_commission_percent=Decimal("10.000"),
                status="new",
            )
            db.add(order)
            db.flush()
            record_bot_order_sale(db, order)
            db.commit()

        with session_factory() as db:
            order = db.query(BotOrder).one()
            record_bot_order_chargeback(db, order)
            record_bot_order_chargeback(db, order)
            db.commit()
            entries = db.query(AccountingEntry).order_by(AccountingEntry.id).all()
            assert len(entries) == 2
            assert sum(entry.sale_amount for entry in entries) == 0
            assert sum(entry.cost_amount for entry in entries) == 0
            assert sum(entry.commission_amount for entry in entries) == 0
            assert sum(entry.profit_amount for entry in entries) == 0
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

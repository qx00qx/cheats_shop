import hashlib
from urllib.parse import parse_qs, urlparse
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_optional_current_user
from app.api.routes import payments as payments_route
from app.database import Base, get_db
from app.main import app
from app.models import (
    AccountingEntry,
    BalanceAudit,
    BotOrder,
    Key,
    ReferralEarning,
    User,
)


def make_balance_purchase_client(monkeypatch, *, balance="1000"):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE categories ADD COLUMN name TEXT"))
        connection.execute(text(
            "INSERT INTO categories (id, slug, title, name) "
            "VALUES (1, 'cs2', 'CS2', 'CS2')"
        ))
        connection.execute(text("""
            CREATE TABLE items (
                id INTEGER PRIMARY KEY,
                name TEXT,
                alias TEXT,
                "categoryData" TEXT,
                tabs TEXT,
                prices TEXT,
                status INTEGER
            )
        """))
        connection.execute(text("""
            INSERT INTO items (id, name, alias, "categoryData", tabs, prices, status)
            VALUES (1, 'Test product', 'test-product', :category_data, '["30 дней"]', '["100"]', 1)
        """), {"category_data": '{"id":1}'})

    with session_factory() as db:
        user = User(
            email="buyer@example.test",
            username="buyer",
            password_hash="hash",
            balance=balance,
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
    app.dependency_overrides[get_optional_current_user] = (
        lambda: SimpleNamespace(id=user_id, email="buyer@example.test")
    )
    monkeypatch.setattr(payments_route, "_next_bot_order_id", lambda db: 7001)
    monkeypatch.setattr(
        payments_route,
        "effective_cheat_discount_percent",
        lambda discount, **_kwargs: discount,
    )
    monkeypatch.setattr(payments_route, "get_promotion_start", lambda _db: None)
    monkeypatch.setattr(payments_route.settings, "SMTP_HOST", "")
    monkeypatch.setattr(payments_route.settings, "SMTP_FROM_EMAIL", "")
    monkeypatch.setattr(payments_route.settings, "PLATEGA_MERCHANT_ID", "merchant-test")
    monkeypatch.setattr(payments_route.settings, "PLATEGA_SECRET", "secret-test")
    return engine, session_factory, TestClient(app), previous, user_id


def test_balance_purchase_queues_order_for_admin_without_stock(monkeypatch):
    engine, session_factory, client, previous, user_id = make_balance_purchase_client(
        monkeypatch
    )
    try:
        response = client.post("/api/payments/buy", json={
            "item_alias": "test-product",
            "tariff_id": 1,
            "payment_method": "balance",
        })

        assert response.status_code == 200
        assert response.json()["status"] == "new"
        assert response.json()["delivery"] is None
        delivery_url = urlparse(response.json()["delivery_url"])
        assert delivery_url.path == "/purchase/delivery"
        delivery_token = parse_qs(delivery_url.query)["token"][0]
        with session_factory() as db:
            user = db.get(User, user_id)
            order = db.query(BotOrder).one()
            audits = db.query(BalanceAudit).order_by(BalanceAudit.id).all()
            assert order.status == "new"
            assert order.email == "buyer@example.test"
            assert order.site_user_id == user_id
            assert order.return_token_hash == hashlib.sha256(
                delivery_token.encode("utf-8")
            ).hexdigest()
            assert user.balance == "905.00"
            assert len(audits) == 2
            assert audits[0].field == "balance"
            assert audits[0].old_balance == "1000"
            assert audits[0].new_balance == "900.00"
            assert audits[0].delta == -100
            assert audits[1].old_balance == "900.00"
            assert audits[1].new_balance == "905.00"
            assert audits[1].delta == 5
            accounting_entry = db.query(AccountingEntry).one()
            assert accounting_entry.entry_type == "sale"
            assert accounting_entry.sale_amount == 100
            assert accounting_entry.turnover_amount == 0
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_platega_purchase_uses_opaque_delivery_return_token(monkeypatch):
    engine, session_factory, client, previous, _ = make_balance_purchase_client(
        monkeypatch
    )
    payment_request = {}
    monkeypatch.setattr(
        payments_route.settings,
        "SITE_URL",
        "https://millex.market:5173",
    )

    async def create_payment(**kwargs):
        payment_request.update(kwargs)
        return {
            "redirect": "https://payments.example.test/checkout",
            "transactionId": "platega-transaction",
        }

    monkeypatch.setattr(payments_route.platega, "create_payment", create_payment)
    try:
        response = client.post("/api/payments/buy", json={
            "item_alias": "test-product",
            "tariff_id": 1,
            "payment_method": "sbp",
        })

        assert response.status_code == 200
        return_url = urlparse(payment_request["return_url"])
        assert return_url.netloc == "millex.market"
        assert return_url.path == "/purchase/delivery"
        query = parse_qs(return_url.query)
        assert query["order_id"] == ["7001"]
        token = query["token"][0]
        assert len(token) >= 32
        assert payment_request["failed_url"] == payment_request["return_url"]

        with session_factory() as db:
            order = db.query(BotOrder).one()
            assert order.return_token_hash == hashlib.sha256(
                token.encode("utf-8")
            ).hexdigest()
            assert token not in order.return_token_hash
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_guest_platega_purchase_creates_unregistered_pending_payment(monkeypatch):
    engine, session_factory, client, previous, _ = make_balance_purchase_client(monkeypatch)
    payment_request = {}

    async def create_payment(**kwargs):
        payment_request.update(kwargs)
        return {
            "redirect": "https://payments.example.test/checkout",
            "transactionId": "guest-platega-transaction",
        }

    monkeypatch.setattr(payments_route.platega, "create_payment", create_payment)
    app.dependency_overrides[get_optional_current_user] = lambda: None
    try:
        response = client.post("/api/payments/buy", json={
            "item_alias": "test-product",
            "tariff_id": 1,
            "payment_method": "sbp",
            "email": "guest@example.com",
        })

        assert response.status_code == 200, response.text
        with session_factory() as db:
            order = db.query(BotOrder).one()
            assert order.status == "pending_payment"
            assert order.site_user_id is None
            assert order.email == "guest@example.com"
            assert order.platega_tx_id == "guest-platega-transaction"
            assert order.guest_payment_notification_sent_at is None
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_guest_confirmed_payment_delivers_key_for_email_worker(monkeypatch):
    engine, session_factory, client, previous, _ = make_balance_purchase_client(monkeypatch)

    async def create_payment(**kwargs):
        return {
            "redirect": "https://payments.example.test/checkout",
            "transactionId": "guest-paid-transaction",
        }

    monkeypatch.setattr(payments_route.platega, "create_payment", create_payment)
    app.dependency_overrides[get_optional_current_user] = lambda: None
    headers = {"X-MerchantId": "merchant-test", "X-Secret": "secret-test"}
    callback = {
        "id": "guest-paid-transaction",
        "amount": 105,
        "currency": "RUB",
        "status": "CONFIRMED",
        "paymentMethod": 2,
    }
    try:
        purchase = client.post("/api/payments/buy", json={
            "item_alias": "test-product",
            "tariff_id": 1,
            "payment_method": "sbp",
            "email": "guest@example.com",
        })
        assert purchase.status_code == 200, purchase.text
        assert purchase.json()["amount"] == 100
        assert purchase.json()["expected_payment_amount"] == 105

        with session_factory() as db:
            db.add(Key(
                item_alias="test-product",
                key_value="GUEST-CHEAT-KEY",
                status="free",
            ))
            db.commit()

        confirmed = client.post(
            "/api/payments/webhook",
            json=callback,
            headers=headers,
        )
        retry = client.post(
            "/api/payments/webhook",
            json=callback,
            headers=headers,
        )

        assert confirmed.status_code == 200, confirmed.text
        assert retry.status_code == 200, retry.text
        with session_factory() as db:
            order = db.query(BotOrder).one()
            key = db.query(Key).one()
            assert order.status == "completed"
            assert order.site_user_id is None
            assert order.email == "guest@example.com"
            assert order.key_value == "GUEST-CHEAT-KEY"
            assert order.email_sent_at is None
            assert key.status == "used"
            assert key.used_at is not None
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_referred_platega_purchase_credits_referrer_once(monkeypatch):
    engine, session_factory, client, previous, user_id = make_balance_purchase_client(
        monkeypatch
    )
    headers = {"X-MerchantId": "merchant-test", "X-Secret": "secret-test"}
    callback = {
        "id": "referred-paid-transaction",
        "amount": 105,
        "currency": "RUB",
        "status": "CONFIRMED",
        "paymentMethod": 2,
    }

    async def create_payment(**_kwargs):
        return {
            "redirect": "https://payments.example.test/checkout",
            "transactionId": "referred-paid-transaction",
        }

    monkeypatch.setattr(payments_route.platega, "create_payment", create_payment)
    try:
        with session_factory() as db:
            referrer = User(
                email="referrer@example.com",
                username="referrer",
                password_hash="hash",
                balance="0",
            )
            db.add(referrer)
            db.flush()
            buyer = db.get(User, user_id)
            buyer.referred_by = referrer.id
            referrer_id = referrer.id
            db.add(Key(
                item_alias="test-product",
                key_value="REFERRED-CHEAT-KEY",
                status="free",
            ))
            db.commit()

        purchase = client.post("/api/payments/buy", json={
            "item_alias": "test-product",
            "tariff_id": 1,
            "payment_method": "sbp",
        })
        assert purchase.status_code == 200, purchase.text

        confirmed = client.post(
            "/api/payments/webhook",
            json=callback,
            headers=headers,
        )
        retry = client.post(
            "/api/payments/webhook",
            json=callback,
            headers=headers,
        )

        assert confirmed.status_code == 200, confirmed.text
        assert retry.status_code == 200, retry.text
        with session_factory() as db:
            referrer = db.get(User, referrer_id)
            earnings = db.query(ReferralEarning).all()
            assert referrer.balance == "5.00"
            assert len(earnings) == 1
            assert earnings[0].commission_amount == 5
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_balance_purchase_auto_delivers_stock_key(monkeypatch):
    engine, session_factory, client, previous, user_id = make_balance_purchase_client(
        monkeypatch
    )
    try:
        with session_factory() as db:
            key = Key(
                item_alias="test-product",
                key_value="AVAILABLE-KEY",
                status="free",
            )
            db.add(key)
            db.commit()
            key_id = key.id

        response = client.post("/api/payments/buy", json={
            "item_alias": "test-product",
            "tariff_id": 1,
            "payment_method": "balance",
        })

        assert response.status_code == 200
        assert response.json()["status"] == "completed"
        assert response.json()["delivery"] is None
        with session_factory() as db:
            order = db.query(BotOrder).one()
            key = db.get(Key, key_id)
            assert order.status == "completed"
            assert order.key_value == "AVAILABLE-KEY"
            assert order.notification_sent_at is None
            assert key.status == "used"
            assert db.get(User, user_id).balance == "905.00"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_balance_purchase_rejects_insufficient_funds_without_order(monkeypatch):
    engine, session_factory, client, previous, user_id = make_balance_purchase_client(
        monkeypatch,
        balance="50",
    )
    try:
        response = client.post("/api/payments/buy", json={
            "item_alias": "test-product",
            "tariff_id": 1,
            "payment_method": "balance",
        })

        assert response.status_code == 400
        with session_factory() as db:
            user = db.get(User, user_id)
            assert user.balance == "50"
            assert db.query(BotOrder).count() == 0
            assert db.query(BalanceAudit).count() == 0
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

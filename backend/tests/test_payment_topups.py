from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.routes import payments as payments_route
from app.database import Base, get_db
from app.main import app
from app.models import BalanceAudit, BalanceTopUp, User


def make_payment_client(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with session_factory() as db:
        user = User(
            email="buyer@example.test",
            username="buyer",
            password_hash="hash",
            balance="10.00",
        )
        db.add(user)
        db.flush()
        user_id = user.id
        db.add(BalanceTopUp(
            transaction_id="test-transaction",
            user_id=user_id,
            amount=100,
            currency="RUB",
            status="pending",
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
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id)
    monkeypatch.setattr(payments_route.settings, "PLATEGA_MERCHANT_ID", "merchant-test")
    monkeypatch.setattr(payments_route.settings, "PLATEGA_SECRET", "secret-test")
    return engine, session_factory, TestClient(app), previous, user_id


def test_confirmed_topup_callback_credits_once_with_nested_payload(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    try:
        callback = {
            "transaction": {
                "id": "test-transaction",
                "status": "CONFIRMED",
                "paymentDetails": {"amount": 100, "currency": "RUB"},
            }
        }
        headers = {"X-MerchantId": "merchant-test", "X-Secret": "secret-test"}

        first_response = client.post(
            "/api/payments/webhook",
            json=callback,
            headers=headers,
        )
        retry_response = client.post(
            "/api/payments/webhook",
            json=callback,
            headers=headers,
        )

        assert first_response.status_code == 200
        assert retry_response.status_code == 200
        with session_factory() as db:
            user = db.get(User, user_id)
            topup = db.query(BalanceTopUp).one()
            audits = db.query(BalanceAudit).filter(
                BalanceAudit.ctx == "PLATEGA_TOPUP:test-transaction"
            ).all()
            assert user.balance == "110.00"
            assert topup.status == "confirmed"
            assert len(audits) == 1
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_documented_platega_callback_shape_confirms_and_reverses_topup(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    headers = {"X-MerchantId": "merchant-test", "X-Secret": "secret-test"}
    callback = {
        "id": "test-transaction",
        "amount": 100,
        "currency": "RUB",
        "status": "CONFIRMED",
        "paymentMethod": 2,
    }
    try:
        confirmed = client.post(
            "/api/payments/webhook",
            json=callback,
            headers=headers,
        )
        chargebacked = client.post(
            "/api/payments/webhook",
            json={**callback, "status": "CHARGEBACKED"},
            headers=headers,
        )

        assert confirmed.status_code == 200
        assert chargebacked.status_code == 200
        with session_factory() as db:
            assert db.get(User, user_id).balance == "10.00"
            topup = db.query(BalanceTopUp).one()
            assert topup.status == "chargebacked"
            assert db.query(BalanceAudit).count() == 2
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_confirmed_topup_with_buyer_surcharge_credits_requested_amount(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    with session_factory() as db:
        topup = db.query(BalanceTopUp).one()
        topup.expected_payment_amount = 105
        db.commit()
    try:
        response = client.post(
            "/api/payments/webhook",
            json={
                "id": "test-transaction",
                "amount": 105,
                "currency": "RUB",
                "status": "CONFIRMED",
                "paymentMethod": 2,
            },
            headers={"X-MerchantId": "merchant-test", "X-Secret": "secret-test"},
        )

        assert response.status_code == 200
        with session_factory() as db:
            assert db.get(User, user_id).balance == "110.00"
            assert db.query(BalanceTopUp).one().status == "confirmed"
            assert db.query(BalanceAudit).count() == 1
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_legacy_topup_uses_callback_payment_method_commission(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    try:
        response = client.post(
            "/api/payments/webhook",
            json={
                "id": "test-transaction",
                "amount": 105,
                "currency": "RUB",
                "status": "CONFIRMED",
                "paymentMethod": 2,
            },
            headers={"X-MerchantId": "merchant-test", "X-Secret": "secret-test"},
        )

        assert response.status_code == 200
        with session_factory() as db:
            assert db.get(User, user_id).balance == "110.00"
            assert db.query(BalanceTopUp).one().status == "confirmed"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_canceled_topup_callback_marks_topup_failed(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    try:
        response = client.post(
            "/api/payments/webhook",
            json={
                "id": "test-transaction",
                "amount": 100,
                "currency": "RUB",
                "status": "CANCELED",
                "paymentMethod": 2,
            },
            headers={"X-MerchantId": "merchant-test", "X-Secret": "secret-test"},
        )

        assert response.status_code == 200
        with session_factory() as db:
            assert db.get(User, user_id).balance == "10.00"
            assert db.query(BalanceTopUp).one().status == "failed"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_confirmed_topup_callback_requires_amount_and_currency(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    try:
        response = client.post(
            "/api/payments/webhook",
            json={"id": "test-transaction", "status": "CONFIRMED"},
            headers={"X-MerchantId": "merchant-test", "X-Secret": "secret-test"},
        )

        assert response.status_code == 400
        with session_factory() as db:
            assert db.get(User, user_id).balance == "10.00"
            assert db.query(BalanceAudit).count() == 0
            assert db.query(BalanceTopUp).one().status == "pending"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_topup_callback_rejects_invalid_shared_secret(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    try:
        response = client.post(
            "/api/payments/webhook",
            json={
                "id": "test-transaction",
                "status": "CONFIRMED",
                "amount": 100,
                "currency": "RUB",
            },
            headers={"X-MerchantId": "merchant-test", "X-Secret": "wrong-secret"},
        )

        assert response.status_code == 403
        with session_factory() as db:
            assert db.get(User, user_id).balance == "10.00"
            assert db.query(BalanceAudit).count() == 0
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_confirmed_topup_callback_rejects_amount_mismatch(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    try:
        response = client.post(
            "/api/payments/webhook",
            json={
                "id": "test-transaction",
                "status": "CONFIRMED",
                "amount": 99,
                "currency": "RUB",
            },
            headers={"X-MerchantId": "merchant-test", "X-Secret": "secret-test"},
        )

        assert response.status_code == 400
        with session_factory() as db:
            assert db.get(User, user_id).balance == "10.00"
            assert db.query(BalanceAudit).count() == 0
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_chargeback_before_confirmation_does_not_credit_balance(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    headers = {"X-MerchantId": "merchant-test", "X-Secret": "secret-test"}
    try:
        chargeback_response = client.post(
            "/api/payments/webhook",
            json={"id": "test-transaction", "status": "CHARGEBACK"},
            headers=headers,
        )
        confirmed_response = client.post(
            "/api/payments/webhook",
            json={
                "id": "test-transaction",
                "status": "CONFIRMED",
                "amount": 100,
                "currency": "RUB",
            },
            headers=headers,
        )

        assert chargeback_response.status_code == 200
        assert confirmed_response.status_code == 200
        with session_factory() as db:
            assert db.get(User, user_id).balance == "10.00"
            assert db.query(BalanceAudit).count() == 0
            assert db.query(BalanceTopUp).one().status == "chargebacked"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_topup_callback_rejects_unknown_reference_without_crediting(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    try:
        response = client.post(
            "/api/payments/webhook",
            json={
                "id": "unknown-transaction",
                "status": "CONFIRMED",
                "amount": 50000,
                "currency": "RUB",
                "payload": f"balance:{user_id}:RUB:50000:missing-reference",
            },
            headers={"X-MerchantId": "merchant-test", "X-Secret": "secret-test"},
        )

        assert response.status_code == 404
        with session_factory() as db:
            assert db.get(User, user_id).balance == "10.00"
            assert db.query(BalanceAudit).count() == 0
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_status_check_credits_confirmed_topup_once(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)

    async def get_transaction_status(transaction_id):
        assert transaction_id == "test-transaction"
        return {
            "id": transaction_id,
            "status": "CONFIRMED",
            "paymentDetails": {"amount": 100, "currency": "RUB"},
        }

    monkeypatch.setattr(
        payments_route.platega,
        "get_transaction_status",
        get_transaction_status,
    )
    try:
        first_response = client.get("/api/payments/topup/latest")
        retry_response = client.get("/api/payments/topup/latest")

        assert first_response.status_code == 200
        assert first_response.json()["status"] == "confirmed"
        assert retry_response.status_code == 200
        assert retry_response.json()["status"] == "confirmed"
        with session_factory() as db:
            assert db.get(User, user_id).balance == "110.00"
            assert db.query(BalanceAudit).count() == 1
            assert db.query(BalanceTopUp).one().status == "confirmed"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_status_check_does_not_credit_pending_topup(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)

    async def get_transaction_status(transaction_id):
        return {
            "id": transaction_id,
            "status": "PENDING",
            "paymentDetails": {"amount": 100, "currency": "RUB"},
        }

    monkeypatch.setattr(
        payments_route.platega,
        "get_transaction_status",
        get_transaction_status,
    )
    try:
        response = client.get("/api/payments/topup/latest")

        assert response.status_code == 200
        assert response.json()["status"] == "pending"
        with session_factory() as db:
            assert db.get(User, user_id).balance == "10.00"
            assert db.query(BalanceAudit).count() == 0
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_status_check_rejects_different_transaction_id(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)

    async def get_transaction_status(transaction_id):
        return {
            "id": "some-other-transaction",
            "status": "CONFIRMED",
            "paymentDetails": {"amount": 100, "currency": "RUB"},
        }

    monkeypatch.setattr(
        payments_route.platega,
        "get_transaction_status",
        get_transaction_status,
    )
    try:
        response = client.get("/api/payments/topup/latest")

        assert response.status_code == 502
        with session_factory() as db:
            assert db.get(User, user_id).balance == "10.00"
            assert db.query(BalanceAudit).count() == 0
            assert db.query(BalanceTopUp).one().status == "pending"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_topup_persists_transaction_and_uses_public_return_url(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    captured_request = {}

    async def create_payment(**kwargs):
        captured_request.update(kwargs)
        return {
            "redirect": "https://pay.example.test/checkout",
            "transactionId": "new-transaction",
        }

    monkeypatch.setattr(payments_route.settings, "SITE_URL", "https://millex.market")
    monkeypatch.setattr(payments_route.platega, "create_payment", create_payment)
    try:
        response = client.post(
            "/api/payments/topup",
            json={"amount": 100, "currency": "RUB", "payment_method": "sbp"},
        )

        assert response.status_code == 200
        reference = response.json()["reference"]
        assert response.json()["amount"] == 100
        assert response.json()["expected_payment_amount"] == 105
        assert captured_request["return_url"] == (
            f"https://millex.market/profile/balance?payment=return&reference={reference}"
        )
        assert captured_request["failed_url"] == (
            f"https://millex.market/profile/balance?payment=failed&reference={reference}"
        )
        with session_factory() as db:
            topup = db.query(BalanceTopUp).filter(
                BalanceTopUp.transaction_id == "new-transaction"
            ).one()
            assert topup.user_id == user_id
            assert str(topup.amount) == "100.00"
            assert str(topup.expected_payment_amount) == "105.00"
            assert topup.status == "pending"
            assert topup.request_notification_sent_at is None
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_topup_rejects_amount_below_50_rubles(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    try:
        response = client.post(
            "/api/payments/topup",
            json={"amount": 49.99, "currency": "RUB", "payment_method": "sbp"},
        )

        assert response.status_code == 422
        with session_factory() as db:
            assert db.query(BalanceTopUp).count() == 1
            assert db.get(User, user_id).balance == "10.00"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_topup_accepts_exactly_50_rubles(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)

    async def create_payment(**kwargs):
        assert kwargs["amount"] == 50
        return {
            "redirect": "https://pay.example.test/checkout",
            "transactionId": "minimum-transaction",
        }

    monkeypatch.setattr(payments_route.platega, "create_payment", create_payment)
    try:
        response = client.post(
            "/api/payments/topup",
            json={"amount": 50, "currency": "RUB", "payment_method": "sbp"},
        )

        assert response.status_code == 200
        with session_factory() as db:
            topup = db.query(BalanceTopUp).filter(
                BalanceTopUp.transaction_id == "minimum-transaction"
            ).one()
            assert topup.user_id == user_id
            assert str(topup.amount) == "50.00"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_topup_callback_can_match_by_reference_before_create_request_finishes(monkeypatch):
    engine, session_factory, client, previous, user_id = make_payment_client(monkeypatch)
    with session_factory() as db:
        db.add(BalanceTopUp(
            reference="early-callback-reference",
            transaction_id=None,
            user_id=user_id,
            amount=100,
            currency="RUB",
            status="pending",
        ))
        db.commit()
    try:
        response = client.post(
            "/api/payments/webhook",
            json={
                "id": "early-transaction",
                "status": "CONFIRMED",
                "amount": 100,
                "currency": "RUB",
                "payload": f"balance:{user_id}:RUB:100:early-callback-reference",
            },
            headers={"X-MerchantId": "merchant-test", "X-Secret": "secret-test"},
        )

        assert response.status_code == 200
        with session_factory() as db:
            topup = db.query(BalanceTopUp).filter(
                BalanceTopUp.reference == "early-callback-reference"
            ).one()
            user = db.get(User, user_id)
            assert topup.transaction_id == "early-transaction"
            assert topup.status == "confirmed"
            assert user.balance == "110.00"
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

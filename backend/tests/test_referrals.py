from decimal import Decimal
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.database import Base, get_db
from app.main import CORS_ALLOWED_ORIGINS, app
from app.models import BalanceAudit, ReferralEarning, User
from app.services.referrals import (
    award_referral_commission,
    reverse_referral_commission,
)


def make_referral_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with session_factory() as db:
        referrer = User(
            email="referrer@example.test",
            username="referrer",
            password_hash="hash",
            balance="0",
        )
        db.add(referrer)
        db.commit()
        referrer_id = referrer.id

    def override_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=referrer_id)
    return engine, session_factory, TestClient(app), previous, referrer_id


def test_referral_link_is_generated_and_attributes_new_registration(monkeypatch):
    async def allow_registration(_client_address):
        return True, 1

    monkeypatch.setattr(
        "app.main.check_registration_rate_limit",
        allow_registration,
    )
    engine, session_factory, client, previous, referrer_id = make_referral_client()
    try:
        first = client.get("/api/referrals/me")
        second = client.get("/api/referrals/me")

        assert first.status_code == 200
        assert first.json()["code"] == second.json()["code"]
        assert first.json()["link"].endswith(
            f"/register?ref={first.json()['code']}"
        )
        assert first.json()["commission_percent"] == 5

        registration = client.post("/api/auth/register", json={
            "email": "invited@example.com",
            "username": "invited",
            "password": "secure-password",
            "referral_code": first.json()["code"].lower(),
        })
        assert registration.status_code == 200

        with session_factory() as db:
            invited = db.query(User).filter_by(username="invited").one()
            assert invited.referred_by == referrer_id
            buyer_id = invited.id
            assert award_referral_commission(
                db,
                buyer=invited,
                sale_amount=Decimal("200"),
                source_type="store_order",
                source_id=456,
            ) == Decimal("10.00")
            db.commit()

        updated = client.get("/api/referrals/me")
        assert updated.json()["invited_count"] == 1
        assert updated.json()["invitees"] == [
            {
                "username": "invited",
                "created_at": updated.json()["invitees"][0]["created_at"],
                "purchases_count": 1,
                "earned_total": 10.0,
            }
        ]
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=buyer_id)
        invited_view = client.get("/api/referrals/me")
        assert invited_view.status_code == 200
        assert invited_view.json()["invited_by"] == "referrer"
        assert invited_view.json()["invitees"] == []
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_registration_rate_limit_blocks_before_request_validation(monkeypatch):
    seen_addresses = []

    async def deny_registration(client_address):
        seen_addresses.append(client_address)
        return False, 37

    monkeypatch.setattr(
        "app.main.check_registration_rate_limit",
        deny_registration,
    )
    engine, _, client, previous, _ = make_referral_client()
    try:
        response = client.post(
            "/api/auth/register",
            json={},
            headers={"Origin": next(iter(CORS_ALLOWED_ORIGINS))},
        )

        assert response.status_code == 429
        assert response.headers["Retry-After"] == "37"
        assert response.headers["access-control-allow-origin"] == next(
            iter(CORS_ALLOWED_ORIGINS)
        )
        assert response.json()["detail"] == (
            "Слишком много попыток регистрации. Попробуйте позже."
        )
        assert seen_addresses == ["testclient"]
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_referral_commission_is_idempotent_and_reversed_once():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    try:
        with session_factory.begin() as db:
            referrer = User(
                email="referrer@example.test",
                username="referrer",
                password_hash="hash",
                balance="0",
            )
            buyer = User(
                email="buyer@example.test",
                username="buyer",
                password_hash="hash",
                balance="0",
            )
            db.add_all([referrer, buyer])
            db.flush()
            buyer.referred_by = referrer.id

            assert award_referral_commission(
                db,
                buyer=buyer,
                sale_amount=Decimal("100"),
                source_type="bot_order",
                source_id=123,
            ) == Decimal("5.00")
            assert award_referral_commission(
                db,
                buyer=buyer,
                sale_amount=Decimal("100"),
                source_type="bot_order",
                source_id=123,
            ) == Decimal("0.00")

        with session_factory.begin() as db:
            assert reverse_referral_commission(
                db,
                source_type="bot_order",
                source_id=123,
            ) == Decimal("5.00")
            assert reverse_referral_commission(
                db,
                source_type="bot_order",
                source_id=123,
            ) == Decimal("0.00")

        with session_factory() as db:
            referrer = db.query(User).filter_by(username="referrer").one()
            earning = db.query(ReferralEarning).one()
            assert referrer.balance == "0.00"
            assert earning.reversed is True
            assert db.query(BalanceAudit).count() == 2
    finally:
        engine.dispose()

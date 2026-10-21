from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin
from app.database import Base, get_db
from app.main import app
from app.models import BalanceAudit, User


def test_admin_can_set_user_balance_and_audit_change():
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
            balance="20.00",
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
    app.dependency_overrides[get_current_admin] = lambda: SimpleNamespace(id=91)
    client = TestClient(app)
    try:
        response = client.patch(
            f"/api/admin/users/{user_id}/balance",
            json={"balance": "125.50"},
        )

        assert response.status_code == 200
        assert response.json() == {"id": user_id, "balance": 125.5}
        with session_factory() as db:
            assert db.get(User, user_id).balance == "125.50"
            audit = db.query(BalanceAudit).one()
            assert audit.user_id == user_id
            assert audit.old_balance == "20.00"
            assert audit.new_balance == "125.50"
            assert audit.delta == 105.5
            assert audit.ctx == "ADMIN_BALANCE_UPDATE:admin=91"

        missing_user = client.patch(
            "/api/admin/users/9999/balance",
            json={"balance": "100"},
        )
        assert missing_user.status_code == 404
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_admin_can_set_user_loyalty_discount_within_limit():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with session_factory() as db:
        user = User(
            email="discount-buyer@example.test",
            username="discount-buyer",
            password_hash="hash",
            discount_percent=2,
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
    app.dependency_overrides[get_current_admin] = lambda: SimpleNamespace(id=91)
    client = TestClient(app)
    try:
        response = client.patch(
            f"/api/admin/users/{user_id}/discount",
            json={"discount_percent": 7},
        )

        assert response.status_code == 200
        assert response.json() == {"id": user_id, "discount_percent": 7}
        with session_factory() as db:
            assert db.get(User, user_id).discount_percent == 7

        invalid_discount = client.patch(
            f"/api/admin/users/{user_id}/discount",
            json={"discount_percent": 11},
        )
        assert invalid_discount.status_code == 422

        missing_user = client.patch(
            "/api/admin/users/9999/discount",
            json={"discount_percent": 5},
        )
        assert missing_user.status_code == 404
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

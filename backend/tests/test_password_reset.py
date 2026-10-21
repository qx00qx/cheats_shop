from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.api.routes import auth as auth_route
from app.core.security import create_access_token, hash_password, verify_password
from app.database import Base
from app.main import app
from app.models import PasswordResetToken, User


def make_password_reset_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with session_factory() as db:
        user = User(
            email="buyer@example.com",
            username="buyer",
            password_hash=hash_password("OldPassword123"),
            balance="0",
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
    return engine, session_factory, TestClient(app), previous, user_id


def test_password_reset_request_reports_unknown_email_without_sending(monkeypatch):
    engine, _, client, previous, _ = make_password_reset_client()
    sent_emails = []
    monkeypatch.setattr(
        auth_route,
        "send_password_reset_email",
        lambda **kwargs: sent_emails.append(kwargs),
    )
    try:
        known = client.post(
            "/api/auth/password-reset/request",
            json={"email": "buyer@example.com"},
        )
        unknown = client.post(
            "/api/auth/password-reset/request",
            json={"email": "missing@example.com"},
        )

        assert known.status_code == 200
        assert known.json()["message"] == (
            "На ваш email отправлена ссылка для восстановления пароля"
        )
        assert unknown.status_code == 404
        assert unknown.json()["detail"] == "Пользователь с таким email не найден."
        assert len(sent_emails) == 1
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_password_reset_changes_password_consumes_token_and_invalidates_sessions(monkeypatch):
    engine, session_factory, client, previous, user_id = make_password_reset_client()
    sent_emails = []
    monkeypatch.setattr(
        auth_route,
        "send_password_reset_email",
        lambda **kwargs: sent_emails.append(kwargs),
    )
    try:
        response = client.post(
            "/api/auth/password-reset/request",
            json={"email": "buyer@example.com"},
        )
        assert response.status_code == 200
        reset_url = sent_emails[0]["reset_url"]
        token = parse_qs(urlparse(reset_url).query)["token"][0]
        old_access_token = create_access_token(str(user_id), {"ver": 0})

        reset = client.post(
            "/api/auth/password-reset/confirm",
            json={"token": token, "password": "NewPassword456"},
        )

        assert reset.status_code == 200
        assert reset.json()["message"] == "Пароль успешно изменён. Войдите с новым паролем."
        with session_factory() as db:
            user = db.get(User, user_id)
            assert verify_password("NewPassword456", user.password_hash)
            assert user.token_version == 1
            assert db.query(PasswordResetToken).count() == 0

        old_session = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {old_access_token}"},
        )
        reused_token = client.post(
            "/api/auth/password-reset/confirm",
            json={"token": token, "password": "AnotherPassword789"},
        )
        assert old_session.status_code == 401
        assert reused_token.status_code == 400
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_password_reset_request_is_rate_limited_per_account(monkeypatch):
    engine, _, client, previous, _ = make_password_reset_client()
    sent_emails = []
    monkeypatch.setattr(
        auth_route,
        "send_password_reset_email",
        lambda **kwargs: sent_emails.append(kwargs),
    )
    try:
        first = client.post(
            "/api/auth/password-reset/request",
            json={"email": "buyer@example.com"},
        )
        second = client.post(
            "/api/auth/password-reset/request",
            json={"email": "buyer@example.com"},
        )

        assert first.status_code == second.status_code == 200
        assert first.json() == second.json()
        assert len(sent_emails) == 1
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_password_reset_url_uses_canonical_https_domain(monkeypatch):
    engine, _, client, previous, _ = make_password_reset_client()
    sent_emails = []
    monkeypatch.setattr(auth_route.settings, "SITE_URL", "http://millex.market:5173")
    monkeypatch.setattr(
        auth_route,
        "send_password_reset_email",
        lambda **kwargs: sent_emails.append(kwargs),
    )
    try:
        response = client.post(
            "/api/auth/password-reset/request",
            json={"email": "buyer@example.com"},
        )

        assert response.status_code == 200
        reset_url = sent_emails[0]["reset_url"]
        parsed = urlparse(reset_url)
        assert parsed.scheme == "https"
        assert parsed.netloc == "millex.market"
        assert parsed.path == "/reset-password"
        assert parse_qs(parsed.query)["token"]
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()

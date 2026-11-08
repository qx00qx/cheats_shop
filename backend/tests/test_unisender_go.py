import json

import httpx
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.api.routes.emailer import _user_emails
from app.services import unisender_go


def test_unisender_go_sends_batches_and_reports_rejected_addresses(monkeypatch):
    sent_requests = []
    rejected_address = "rejected@example.com"

    def handle_request(request: httpx.Request) -> httpx.Response:
        sent_requests.append(request)
        assert str(request.url) == (
            "https://goapi.unisender.ru/ru/transactional/api/v1/email/send.json"
        )
        assert request.headers["X-API-KEY"] == "test-api-key"
        return httpx.Response(
            200,
            json={
                "status": "success",
                "job_id": "job-123",
                "failed_emails": {rejected_address: "invalid address"},
            },
        )

    monkeypatch.setattr(unisender_go.settings, "UNISENDER_GO_API_KEY", "test-api-key")
    monkeypatch.setattr(
        unisender_go.settings,
        "UNISENDER_GO_API_URL",
        "https://goapi.unisender.ru/ru/transactional/api/v1/",
    )
    with httpx.Client(transport=httpx.MockTransport(handle_request)) as client:
        failed = unisender_go.send_email_batch(
            client,
            subject="Test",
            from_email="news@example.com",
            recipients=["first@example.com", rejected_address],
            body_html="<p>Test</p>",
            idempotence_key="emailer-10-0",
            cc_email="archive@example.com",
        )

    assert len(sent_requests) == 1
    request_body = json.loads(sent_requests[0].read())
    message = request_body["message"]
    assert message["skip_unsubscribe"] == 0
    assert message["bypass_unsubscribed"] == 0
    assert message["headers"]["CC"] == "archive@example.com"
    assert failed == {rejected_address}


def test_unisender_go_rejects_more_than_500_recipients(monkeypatch):
    monkeypatch.setattr(unisender_go.settings, "UNISENDER_GO_API_KEY", "test-api-key")
    monkeypatch.setattr(
        unisender_go.settings,
        "UNISENDER_GO_API_URL",
        "https://goapi.unisender.ru/ru/transactional/api/v1",
    )
    with httpx.Client(transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json={"status": "success"})
    )) as client:
        with pytest.raises(ValueError, match="1-500 recipients"):
            unisender_go.send_email_batch(
                client,
                subject="Test",
                from_email="news@example.com",
                recipients=["user@example.com"] * 501,
                body_html="<p>Test</p>",
                idempotence_key="emailer-10-0",
            )


def test_unisender_go_does_not_accept_unexpected_success_response(monkeypatch):
    monkeypatch.setattr(unisender_go.settings, "UNISENDER_GO_API_KEY", "test-api-key")
    monkeypatch.setattr(
        unisender_go.settings,
        "UNISENDER_GO_API_URL",
        "https://goapi.unisender.ru/ru/transactional/api/v1",
    )
    with httpx.Client(transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json={"message": "unexpected"})
    )) as client:
        with pytest.raises(RuntimeError, match="rejected the request"):
            unisender_go.send_email_batch(
                client,
                subject="Test",
                from_email="news@example.com",
                recipients=["user@example.com"],
                body_html="<p>Test</p>",
                idempotence_key="emailer-10-0",
            )


def test_campaign_audience_includes_all_users_and_deduplicates_emails():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                email TEXT,
                is_active BOOLEAN
            )
        """))
        connection.execute(text("""
            INSERT INTO users (id, email, is_active) VALUES
                (1, 'active@example.com', 1),
                (2, 'inactive@example.com', 0),
                (3, 'ACTIVE@example.com', 0),
                (4, '', 1),
                (5, NULL, 1)
        """))

    with Session(engine) as db:
        assert _user_emails(db) == [
            "active@example.com",
            "inactive@example.com",
        ]
    engine.dispose()

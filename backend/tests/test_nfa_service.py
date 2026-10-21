import asyncio

import app.services.nfa as nfa_module
import pytest


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload
        self.status_code = 200

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


class FakeNfaHttpClient:
    statuses = []
    posts = []

    def __init__(self, timeout):
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    async def get(self, url, *, headers):
        assert url.endswith("/api/v1/status")
        assert headers["X-API-Key"] == "test-api-key"
        return FakeResponse(self.statuses.pop(0))

    async def post(self, url, *, json, headers):
        self.posts.append((url, json, headers, self.timeout))
        return FakeResponse({
            "status": "success",
            "message": "activated",
            "activation_key": "key",
            "exe_base64": "TVo=",
            "exe_filename": "steam-account.exe",
        })


def test_nfa_activation_waits_for_steam_and_returns_executable(monkeypatch):
    FakeNfaHttpClient.statuses = [
        {"status": "success", "steam_down": True},
        {"status": "success", "steam_down": False},
    ]
    FakeNfaHttpClient.posts = []
    sleeps = []

    async def fake_sleep(seconds):
        sleeps.append(seconds)

    monkeypatch.setattr(nfa_module.settings, "NFA_API_KEY", "test-api-key")
    monkeypatch.setattr(nfa_module.httpx, "AsyncClient", FakeNfaHttpClient)
    monkeypatch.setattr(nfa_module.asyncio, "sleep", fake_sleep)

    result = asyncio.run(nfa_module.nfa.activate_direct("cs2"))

    assert sleeps == [60]
    assert result["exe_base64"] == "TVo="
    assert FakeNfaHttpClient.posts == [(
        "https://nfa-api.acode.ing/api/v1/activate_direct",
        {"account_type": "cs2"},
        {"X-API-Key": "test-api-key", "Accept": "application/json", "Content-Type": "application/json"},
        140,
    )]


def test_nfa_activation_reports_missing_api_key_as_configuration_error(monkeypatch):
    monkeypatch.setattr(nfa_module.settings, "NFA_API_KEY", "")
    monkeypatch.setattr(nfa_module.settings, "NFA_TOKEN", "")

    with pytest.raises(
        nfa_module.NfaConfigurationError,
        match="NFA_API_KEY в backend/.env",
    ):
        asyncio.run(nfa_module.nfa.activate_direct("cs2"))

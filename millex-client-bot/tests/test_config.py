import os
import unittest
from unittest.mock import patch

from app.config import load_settings


class SettingsTests(unittest.TestCase):
    def test_defaults_to_millex_market(self) -> None:
        with patch.dict(os.environ, {"BOT_TOKEN": "test-token"}, clear=True):
            settings = load_settings()

        self.assertEqual(settings.mini_app_url, "https://millex.market")
        self.assertEqual(settings.telegram_proxy_url, "")

    def test_loads_http_telegram_proxy_url(self) -> None:
        env = {
            "BOT_TOKEN": "test-token",
            "TELEGRAM_PROXY_URL": "http://proxy.example:8080",
        }
        with patch.dict(os.environ, env, clear=True):
            settings = load_settings()

        self.assertEqual(settings.telegram_proxy_url, env["TELEGRAM_PROXY_URL"])

    def test_loads_socks5_telegram_proxy_url(self) -> None:
        env = {
            "BOT_TOKEN": "test-token",
            "TELEGRAM_PROXY_URL": "socks5://proxy.example:1080",
        }
        with patch.dict(os.environ, env, clear=True):
            settings = load_settings()

        self.assertEqual(settings.telegram_proxy_url, env["TELEGRAM_PROXY_URL"])

    def test_rejects_unsupported_telegram_proxy_scheme(self) -> None:
        env = {"BOT_TOKEN": "test-token", "TELEGRAM_PROXY_URL": "ftp://proxy"}
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaisesRegex(ValueError, "HTTP\\(S\\) or SOCKS5"):
                load_settings()

    def test_requires_bot_token(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "BOT_TOKEN is required"):
                load_settings()

    def test_rejects_non_https_mini_app_url(self) -> None:
        env = {"BOT_TOKEN": "test-token", "MINI_APP_URL": "http://millex.market"}
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaisesRegex(ValueError, "valid HTTPS URL"):
                load_settings()


if __name__ == "__main__":
    unittest.main()

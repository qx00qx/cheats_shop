import os
import unittest
from unittest.mock import patch

from app.config import load_settings


class SettingsTests(unittest.TestCase):
    def test_defaults_to_millex_market(self) -> None:
        with patch.dict(os.environ, {"BOT_TOKEN": "test-token"}, clear=True):
            settings = load_settings()

        self.assertEqual(settings.mini_app_url, "https://millex.market")

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

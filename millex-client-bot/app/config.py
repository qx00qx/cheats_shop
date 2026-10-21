import os
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class Settings:
    bot_token: str
    mini_app_url: str


def load_settings() -> Settings:
    bot_token = os.environ.get("BOT_TOKEN", "").strip()
    if not bot_token:
        raise ValueError("BOT_TOKEN is required to start the client bot")

    mini_app_url = os.environ.get("MINI_APP_URL", "https://millex.market").strip()
    parsed_url = urlparse(mini_app_url)
    if parsed_url.scheme != "https" or not parsed_url.netloc:
        raise ValueError("MINI_APP_URL must be a valid HTTPS URL")

    return Settings(bot_token=bot_token, mini_app_url=mini_app_url)

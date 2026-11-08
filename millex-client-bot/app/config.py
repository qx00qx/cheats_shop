import os
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class Settings:
    bot_token: str
    mini_app_url: str
    telegram_proxy_url: str


def load_settings() -> Settings:
    bot_token = os.environ.get("BOT_TOKEN", "").strip()
    if not bot_token:
        raise ValueError("BOT_TOKEN is required to start the client bot")

    mini_app_url = os.environ.get("MINI_APP_URL", "https://millex.market").strip()
    parsed_url = urlparse(mini_app_url)
    if parsed_url.scheme != "https" or not parsed_url.netloc:
        raise ValueError("MINI_APP_URL must be a valid HTTPS URL")

    telegram_proxy_url = os.environ.get("TELEGRAM_PROXY_URL", "").strip()
    if telegram_proxy_url and urlparse(telegram_proxy_url).scheme not in {
        "http",
        "https",
        "socks5",
        "socks5h",
    }:
        raise ValueError("TELEGRAM_PROXY_URL must use HTTP(S) or SOCKS5")

    return Settings(
        bot_token=bot_token,
        mini_app_url=mini_app_url,
        telegram_proxy_url=telegram_proxy_url,
    )

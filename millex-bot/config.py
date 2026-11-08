
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    bot_token: str = Field(alias="BOT_TOKEN")
    database_url: str = Field(alias="DATABASE_URL")
    admin_ids: str = Field(default="", alias="BOT_ADMIN_IDS")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def admin_id_set(self) -> set[int]:
        return {int(x) for x in self.admin_ids.split(",") if x.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
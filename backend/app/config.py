from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Millex"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    DATABASE_URL: str
    REDIS_URL: str = "redis://millex.market:6379/0"
    CORS_ORIGINS: str = "https://millex.market,https://www.millex.market,http://localhost:5173,http://127.0.0.1:5173"
    SITE_URL: str = "https://millex.market"
    # Also accepted if a Compose-only host path is mistakenly copied into backend/.env.
    STATIC_UPLOADS_HOST_DIR: str = ""

    # Platega (приём платежей)
    PLATEGA_MERCHANT_ID: str = ""
    PLATEGA_SECRET: str = ""
    PLATEGA_API: str = "https://app.platega.io"

    NFA_API_BASE_URL: str = "https://nfa-api.acode.ing"
    NFA_API_KEY: str = ""
    NFA_TOKEN: str = ""

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    # Platega (выплаты / payout)
    PLATEGA_PAYOUT_SECRET: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
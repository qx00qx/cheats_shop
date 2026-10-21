from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import Base

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)

SessionMaker = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("SELECT pg_advisory_xact_lock(741205190)"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("""
            ALTER TABLE bot_orders
            ADD COLUMN IF NOT EXISTS guest_payment_notification_sent_at TIMESTAMPTZ DEFAULT now()
        """))
        await conn.execute(text("""
            ALTER TABLE bot_orders
            ALTER COLUMN guest_payment_notification_sent_at DROP DEFAULT
        """))
        await conn.execute(text("""
            DO $$
            BEGIN
                IF to_regclass('balance_topups') IS NOT NULL THEN
                    ALTER TABLE balance_topups
                    ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;
                    ALTER TABLE balance_topups
                    ADD COLUMN IF NOT EXISTS request_notification_sent_at TIMESTAMPTZ DEFAULT now();
                    ALTER TABLE balance_topups
                    ALTER COLUMN request_notification_sent_at DROP DEFAULT;
                END IF;
            END
            $$;
        """))
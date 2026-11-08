from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
import logging

from app.config import settings
from app.database import Base, engine
from app import models
from app.api.routes import accounting, auth, catalog, products, orders, payments, reviews, blog, emailer, accounts, admin, homepage, uploads, feature_categories, seo
from app.storage import UPLOADS_DIR

logger = logging.getLogger(__name__)

# Проверка подключения к БД
try:
    with engine.connect() as conn:
        print("Database connection successful")
except Exception as e:
    print(f"Database connection failed: {e}")
try:
    with engine.begin() as conn:
        conn.execute(text("SELECT pg_advisory_xact_lock(741205190)"))
        Base.metadata.create_all(bind=conn)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS global_promotions (
                campaign_key VARCHAR(64) PRIMARY KEY,
                starts_at TIMESTAMPTZ NOT NULL
            )
        """))
        conn.execute(text("""
            INSERT INTO global_promotions (campaign_key, starts_at)
            VALUES ('launch_week_15', now())
            ON CONFLICT (campaign_key) DO NOTHING
        """))
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0
        """))
        conn.execute(text("""
            ALTER TABLE emailer
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            ADD COLUMN IF NOT EXISTS last_send TIMESTAMPTZ,
            ALTER COLUMN to_email DROP NOT NULL,
            ADD COLUMN IF NOT EXISTS is_sent BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS send_status VARCHAR(16) NOT NULL DEFAULT 'draft',
            ADD COLUMN IF NOT EXISTS recipient_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_error TEXT
        """))
        conn.execute(text("""
            UPDATE emailer
            SET send_status = 'sent'
            WHERE is_sent = TRUE AND send_status = 'draft'
        """))
        conn.execute(text("""
            UPDATE emailer
            SET send_status = CASE
                    WHEN sent_count > 0 THEN 'partial'
                    ELSE 'failed'
                END,
                failed_count = GREATEST(recipient_count - sent_count, 0),
                last_error = COALESCE(
                    last_error,
                    'Backend restarted before the campaign finished.'
                )
            WHERE send_status = 'sending'
        """))
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'ck_users_discount_percent'
                      AND conrelid = 'users'::regclass
                ) THEN
                    ALTER TABLE users
                    ADD CONSTRAINT ck_users_discount_percent
                    CHECK (discount_percent >= 0 AND discount_percent <= 10);
                END IF;
            END
            $$;
        """))
        conn.execute(text("""
            ALTER TABLE order_items
            ADD COLUMN IF NOT EXISTS key_id INTEGER,
            ADD COLUMN IF NOT EXISTS key_value TEXT,
            ADD COLUMN IF NOT EXISTS delivered_qty INTEGER NOT NULL DEFAULT 0
        """))
        conn.execute(text("""
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS email_next_attempt_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS email_last_error TEXT
        """))
        conn.execute(text("""
            ALTER TABLE bot_orders
            ADD COLUMN IF NOT EXISTS platega_tx_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS return_token_hash VARCHAR(64),
            ADD COLUMN IF NOT EXISTS source_order_id BIGINT,
            ADD COLUMN IF NOT EXISTS source_order_item_id BIGINT,
            ADD COLUMN IF NOT EXISTS expected_payment_amount NUMERIC(12, 2),
            ADD COLUMN IF NOT EXISTS delivery_file BYTEA,
            ADD COLUMN IF NOT EXISTS delivery_filename VARCHAR(255),
            ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS email_next_attempt_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS email_last_error TEXT,
            ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ
        """))
        conn.execute(text("""
            ALTER TABLE bot_orders
            ADD COLUMN IF NOT EXISTS accounting_item_id INTEGER,
            ADD COLUMN IF NOT EXISTS accounting_tariff_id INTEGER,
            ADD COLUMN IF NOT EXISTS accounting_cost_amount NUMERIC(12, 2),
            ADD COLUMN IF NOT EXISTS accounting_commission_percent NUMERIC(7, 3)
        """))
        conn.execute(text("""
            ALTER TABLE bot_orders
            ADD COLUMN IF NOT EXISTS guest_payment_notification_sent_at TIMESTAMPTZ DEFAULT now()
        """))
        conn.execute(text("""
            ALTER TABLE bot_orders
            ALTER COLUMN guest_payment_notification_sent_at DROP DEFAULT
        """))
        conn.execute(text("""
            DO $$
            DECLARE
                sequence_name text;
                max_id bigint;
                sequence_last_value bigint;
            BEGIN
                sequence_name := pg_get_serial_sequence('bot_orders', 'id');
                IF sequence_name IS NULL THEN
                    CREATE SEQUENCE IF NOT EXISTS bot_orders_id_seq;
                    ALTER TABLE bot_orders
                    ALTER COLUMN id SET DEFAULT nextval('bot_orders_id_seq'::regclass);
                    ALTER SEQUENCE bot_orders_id_seq OWNED BY bot_orders.id;
                    sequence_name := 'bot_orders_id_seq';
                END IF;

                SELECT MAX(id) INTO max_id FROM bot_orders;
                IF max_id IS NOT NULL THEN
                    EXECUTE format(
                        'SELECT last_value FROM %s',
                        sequence_name::regclass
                    ) INTO sequence_last_value;
                    IF max_id >= sequence_last_value THEN
                        PERFORM setval(sequence_name::regclass, max_id, true);
                    END IF;
                END IF;
            END
            $$;
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_bot_orders_platega_tx_id
            ON bot_orders (platega_tx_id)
        """))
        if inspect(conn).has_table("balance_topups"):
            conn.execute(text("""
                ALTER TABLE balance_topups
                ADD COLUMN IF NOT EXISTS reference VARCHAR(64),
                ADD COLUMN IF NOT EXISTS expected_payment_amount NUMERIC(12, 2),
                ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ
            """))
            conn.execute(text("""
                ALTER TABLE balance_topups
                ADD COLUMN IF NOT EXISTS request_notification_sent_at TIMESTAMPTZ DEFAULT now()
            """))
            conn.execute(text("""
                ALTER TABLE balance_topups
                ALTER COLUMN request_notification_sent_at DROP DEFAULT
            """))
            conn.execute(text("""
                ALTER TABLE balance_topups
                ALTER COLUMN transaction_id DROP NOT NULL
            """))
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS ix_balance_topups_reference
                ON balance_topups (reference)
            """))
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS ix_balance_topups_transaction_id
                ON balance_topups (transaction_id)
            """))
        if inspect(conn).has_table("items"):
            conn.execute(text("""
                ALTER TABLE items
                ADD COLUMN IF NOT EXISTS gallery JSONB,
                ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255),
                ADD COLUMN IF NOT EXISTS seo_description TEXT,
                ADD COLUMN IF NOT EXISTS seo_image TEXT,
                ADD COLUMN IF NOT EXISTS seo_noindex BOOLEAN NOT NULL DEFAULT FALSE
            """))
            conn.execute(text("""
                ALTER TABLE items
                ADD COLUMN IF NOT EXISTS security_status INTEGER
            """))
            conn.execute(text("""
                UPDATE items
                SET security_status = CASE
                    WHEN COALESCE(undetected, 0) = 1 THEN 1
                    ELSE 2
                END
                WHERE security_status IS NULL
            """))
            conn.execute(text("""
                ALTER TABLE items
                ALTER COLUMN security_status SET DEFAULT 2,
                ALTER COLUMN security_status SET NOT NULL
            """))
            conn.execute(text("""
                UPDATE items
                SET gallery =
                    CASE
                        WHEN NULLIF(BTRIM(preview), '') IS NOT NULL
                        THEN jsonb_build_array(jsonb_build_object(
                            'type', 'image', 'url', BTRIM(preview), 'alt', ''
                        ))
                        ELSE '[]'::jsonb
                    END
                    ||
                    CASE
                        WHEN NULLIF(BTRIM(video), '') IS NOT NULL
                        THEN jsonb_build_array(jsonb_build_object(
                            'type', 'video', 'url', BTRIM(video), 'alt', ''
                        ))
                        ELSE '[]'::jsonb
                    END
                WHERE gallery IS NULL
            """))
        if inspect(conn).has_table("categories"):
            conn.execute(text("""
                ALTER TABLE categories
                ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255),
                ADD COLUMN IF NOT EXISTS seo_description TEXT,
                ADD COLUMN IF NOT EXISTS seo_image TEXT,
                ADD COLUMN IF NOT EXISTS seo_noindex BOOLEAN NOT NULL DEFAULT FALSE
            """))
        if inspect(conn).has_table("blog"):
            conn.execute(text("""
                ALTER TABLE blog
                ADD COLUMN IF NOT EXISTS seo_image TEXT,
                ADD COLUMN IF NOT EXISTS seo_noindex BOOLEAN NOT NULL DEFAULT FALSE
            """))
    print("Tables created successfully")
except Exception as e:
    print(f"Failed to create tables: {e}")

app = FastAPI(title=settings.APP_NAME, version="2.0")
logger.info(
    "Platega payment environment loaded: merchant_id_configured=%s secret_configured=%s",
    bool(settings.PLATEGA_MERCHANT_ID),
    bool(settings.PLATEGA_SECRET),
)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(reviews.router)
app.include_router(blog.router)
app.include_router(emailer.router)
app.include_router(accounts.router)
app.include_router(admin.router)
app.include_router(accounting.router)
app.include_router(homepage.router)
app.include_router(uploads.router)
app.include_router(feature_categories.router)
app.include_router(seo.router)


@app.get("/api/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ok", "app": settings.APP_NAME}
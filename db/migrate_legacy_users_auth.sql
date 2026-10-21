BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);

DO $$
DECLARE
    created_at_type TEXT;
BEGIN
    SELECT data_type
    INTO created_at_type
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'users'
      AND column_name = 'created_at';

    IF created_at_type IN ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision') THEN
        ALTER TABLE users
            ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
            USING CASE
                WHEN created_at IS NULL THEN NULL
                ELSE to_timestamp(created_at::DOUBLE PRECISION)
            END;
    ELSIF created_at_type = 'timestamp without time zone' THEN
        ALTER TABLE users
            ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
            USING created_at AT TIME ZONE 'UTC';
    END IF;
END $$;

UPDATE users SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE users ALTER COLUMN created_at SET NOT NULL;

COMMIT;
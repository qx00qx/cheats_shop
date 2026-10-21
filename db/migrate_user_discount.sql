ALTER TABLE users
ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0;

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

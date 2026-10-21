-- Сделать last_send nullable
ALTER TABLE emaile  ALTER COLUMN last_send DROP NOT NULL;
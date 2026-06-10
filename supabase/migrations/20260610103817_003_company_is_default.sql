ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

UPDATE company_settings SET is_default = true WHERE id = (SELECT id FROM company_settings ORDER BY created_at LIMIT 1);

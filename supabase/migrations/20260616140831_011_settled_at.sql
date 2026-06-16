ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS settled_at timestamptz DEFAULT NULL;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS majoration integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS majoration_type text NOT NULL DEFAULT 'fixed'
    CHECK (majoration_type IN ('percentage', 'fixed'));

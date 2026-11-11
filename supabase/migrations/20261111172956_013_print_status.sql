/*
# Add print tracking columns to sales table

1. Modified Tables
- `sales`
  - Added `print_status` (text, default 'pending', CHECK constraint in 'pending','printed')
  - Added `printed_at` (timestamptz, nullable) — timestamp when the order was marked as printed

2. Security
- No new RLS policies needed — existing sales policies already allow authenticated users to UPDATE the sales table.

3. Notes
- When a sale is recorded, print_status defaults to 'pending', so it automatically appears in the print queue.
- Marking an order as printed sets print_status to 'printed' and printed_at to now().
- This is a non-destructive migration: it only adds columns with defaults.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'print_status'
  ) THEN
    ALTER TABLE sales ADD COLUMN print_status text NOT NULL DEFAULT 'pending'
      CHECK (print_status IN ('pending', 'printed'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'printed_at'
  ) THEN
    ALTER TABLE sales ADD COLUMN printed_at timestamptz;
  END IF;
END $$;

-- Prestations de service
CREATE TABLE IF NOT EXISTS services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  amount decimal(12,2) NOT NULL,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  client_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_services" ON services FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_services" ON services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_services" ON services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_services" ON services FOR DELETE TO authenticated USING (true);

-- Dépenses
CREATE TABLE IF NOT EXISTS expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL DEFAULT 'divers' CHECK (category IN ('achat', 'divers')),
  name text NOT NULL,
  amount decimal(12,2) NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_expenses" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_expenses" ON expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_expenses" ON expenses FOR DELETE TO authenticated USING (true);

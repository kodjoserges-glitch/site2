-- Sequence for invoice numbers
CREATE SEQUENCE sale_invoice_seq START 1;

-- Articles table (printing materials)
CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_per_sqm decimal(10,2) NOT NULL,
  unit text DEFAULT 'm²',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sales table
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL DEFAULT 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('sale_invoice_seq')::text, 4, '0'),
  client_name text NOT NULL,
  article_id uuid REFERENCES articles(id) NOT NULL,
  article_name text NOT NULL,
  width decimal(10,2) NOT NULL,
  length decimal(10,2) NOT NULL,
  surface decimal(10,2) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price_per_sqm decimal(10,2) NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  discount decimal(10,2) DEFAULT 0,
  discount_type text DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  total decimal(10,2) NOT NULL,
  amount_paid decimal(10,2) DEFAULT 0,
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'advance', 'unpaid')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies for articles
CREATE POLICY "select_articles" ON articles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_articles" ON articles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_articles" ON articles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_articles" ON articles FOR DELETE TO authenticated USING (true);

-- RLS Policies for sales
CREATE POLICY "select_sales" ON sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sales" ON sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sales" ON sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sales" ON sales FOR DELETE TO authenticated USING (true);

-- Insert default articles
INSERT INTO articles (name, price_per_sqm) VALUES
  ('Bâche publicitaire', 5000),
  ('Vinyle autocollant', 7500),
  ('Papier peint', 6000),
  ('Toile Canvas', 8000),
  ('Plexiglas', 15000),
  ('Aluminium composite', 12000);
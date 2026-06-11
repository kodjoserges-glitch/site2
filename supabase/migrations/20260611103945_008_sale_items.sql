CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  article_name TEXT NOT NULL,
  pricing_type TEXT NOT NULL DEFAULT 'sqm',
  width NUMERIC NOT NULL DEFAULT 0,
  length NUMERIC NOT NULL DEFAULT 0,
  surface NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_per_sqm NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_sale_items" ON sale_items FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_sale_items" ON sale_items FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_sale_items" ON sale_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sale_items" ON sale_items FOR DELETE
  TO authenticated USING (true);

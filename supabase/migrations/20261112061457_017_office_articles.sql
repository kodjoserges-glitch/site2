/*
# Articles Bureautiques & Consommables — Stock et Vente

## Objectif
Ajouter la gestion d'articles bureautique et consommables (stylos, papier, ramettes, classeurs, etc.)
avec un suivi de stock (entrees/sorties) et une interface de vente separee de la vente d'impression.

## Nouvelles tables

### 1. `office_items` — Catalogue d'articles bureautique
- `id` (uuid, PK)
- `name` (text, NOT NULL) — nom de l'article
- `sku` (text, unique) — reference/code article
- `category` (text) — categorie (papeterie, consommable, etc.)
- `unit_price` (numeric, NOT NULL) — prix de vente unitaire en FCFA
- `cost_price` (numeric, default 0) — prix d'achat pour le calcul de marge
- `stock_quantity` (integer, NOT NULL, default 0) — quantite en stock
- `min_stock` (integer, default 0) — seuil d'alerte de stock bas
- `unit` (text, default 'piece') — unite de mesure (piece, boite, ramette, etc.)
- `is_active` (boolean, default true) — article actif ou archive
- `created_at`, `updated_at` (timestamptz)

### 2. `office_stock_movements` — Mouvements de stock
- `id` (uuid, PK)
- `item_id` (uuid, FK -> office_items, ON DELETE CASCADE)
- `movement_type` (text, CHECK in 'in','out','adjustment') — entree, sortie, ajustement
- `quantity` (integer, NOT NULL) — quantite du mouvement
- `reason` (text) — raison du mouvement (achat, vente, perte, etc.)
- `actor_id` (uuid) — utilisateur qui a effectue le mouvement
- `actor_name` (text) — nom de l'utilisateur
- `created_at` (timestamptz)

### 3. `office_sales` — Ventes d'articles bureautique
- `id` (uuid, PK)
- `invoice_number` (text, unique) — numero de facture
- `client_name` (text, NOT NULL) — nom du client
- `total_amount` (numeric, NOT NULL) — montant total
- `amount_paid` (numeric, default 0) — montant paye
- `payment_status` (text, CHECK in 'paid','advance','unpaid')
- `seller_id` (uuid) — vendeur
- `seller_name` (text) — nom du vendeur
- `items_json` (jsonb) — detail des articles vendus
- `notes` (text)
- `created_at`, `updated_at` (timestamptz)

## Securite (RLS)
- Toutes les tables: CRUD pour `authenticated` (tous les utilisateurs connectes)
- Politiques separees par verbe (SELECT, INSERT, UPDATE, DELETE)
*/

-- ============================================================
-- 1. office_items
-- ============================================================
CREATE TABLE IF NOT EXISTS office_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  category text NOT NULL DEFAULT 'Divers',
  unit_price numeric NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pièce',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE office_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON office_items TO authenticated;

DROP POLICY IF EXISTS "select_office_items" ON office_items;
CREATE POLICY "select_office_items" ON office_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_office_items" ON office_items;
CREATE POLICY "insert_office_items" ON office_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_office_items" ON office_items;
CREATE POLICY "update_office_items" ON office_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_office_items" ON office_items;
CREATE POLICY "delete_office_items" ON office_items FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 2. office_stock_movements
-- ============================================================
CREATE TABLE IF NOT EXISTS office_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES office_items(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity integer NOT NULL,
  reason text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE office_stock_movements ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON office_stock_movements TO authenticated;

DROP POLICY IF EXISTS "select_stock_movements" ON office_stock_movements;
CREATE POLICY "select_stock_movements" ON office_stock_movements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_stock_movements" ON office_stock_movements;
CREATE POLICY "insert_stock_movements" ON office_stock_movements FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_stock_movements" ON office_stock_movements;
CREATE POLICY "update_stock_movements" ON office_stock_movements FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_stock_movements" ON office_stock_movements;
CREATE POLICY "delete_stock_movements" ON office_stock_movements FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 3. office_sales
-- ============================================================
CREATE TABLE IF NOT EXISTS office_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  client_name text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'advance', 'unpaid')),
  seller_id uuid,
  seller_name text,
  items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE office_sales ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON office_sales TO authenticated;

DROP POLICY IF EXISTS "select_office_sales" ON office_sales;
CREATE POLICY "select_office_sales" ON office_sales FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_office_sales" ON office_sales;
CREATE POLICY "insert_office_sales" ON office_sales FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_office_sales" ON office_sales;
CREATE POLICY "update_office_sales" ON office_sales FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_office_sales" ON office_sales;
CREATE POLICY "delete_office_sales" ON office_sales FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_office_items_category ON office_items(category);
CREATE INDEX IF NOT EXISTS idx_office_items_active ON office_items(is_active);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON office_stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON office_stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_office_sales_created_at ON office_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_office_sales_seller_id ON office_sales(seller_id);
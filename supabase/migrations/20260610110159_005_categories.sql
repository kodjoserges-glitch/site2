/*
# Ajout des catégories d'articles

## Description
Introduit un système de catégories pour organiser les articles.
Chaque catégorie regroupe un ensemble d'articles liés (ex: "Impression souple", "Impression rigide").
Les articles existants sont rattachés à une catégorie "Général" créée par défaut.

## Nouvelles tables
- `categories` — groupes d'articles
  - `id` (uuid, PK)
  - `name` (text, not null) — nom de la catégorie
  - `color` (text) — couleur hex pour l'affichage visuel
  - `description` (text) — description optionnelle
  - `created_at`, `updated_at`

## Tables modifiées
- `articles` — ajout de la colonne `category_id` (FK → categories, nullable)

## Sécurité
- RLS activé sur `categories`
- Toute opération CRUD autorisée aux utilisateurs authentifiés

## Notes
1. La colonne `category_id` est nullable pour ne pas casser les articles existants.
2. Une catégorie "Général" est insérée par défaut.
3. Tous les articles existants (sans category_id) sont rattachés à cette catégorie.
*/

-- Catégories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#2563eb',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_categories" ON categories;
CREATE POLICY "select_categories" ON categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_categories" ON categories;
CREATE POLICY "insert_categories" ON categories FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_categories" ON categories;
CREATE POLICY "update_categories" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_categories" ON categories;
CREATE POLICY "delete_categories" ON categories FOR DELETE TO authenticated USING (true);

-- Ajout de category_id sur articles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE articles ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Catégorie par défaut
INSERT INTO categories (id, name, color, description)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Général',
  '#2563eb',
  'Catégorie par défaut'
)
ON CONFLICT (id) DO NOTHING;

-- Rattacher les articles sans catégorie à "Général"
UPDATE articles SET category_id = 'a0000000-0000-0000-0000-000000000001'
WHERE category_id IS NULL;

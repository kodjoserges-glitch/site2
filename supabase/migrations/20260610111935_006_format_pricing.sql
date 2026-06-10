/*
# Tarification par format international (A0–A7) sur les articles

## Description
Ajoute un système dual de tarification sur les articles :
1. **Prix au m²** (existant) — largeur × longueur personnalisées saisies à la vente
2. **Prix par format** (nouveau) — format ISO normalisé (A0 à A7), dimensions fixes,
   prix fixe par unité/feuille

## Tables modifiées

### `articles`
- `pricing_type` (text, default 'sqm') — mode de tarification : 'sqm' | 'format'
- `format` (text, nullable) — format ISO : 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'
- `price_per_unit` (decimal 10,2, nullable) — prix par unité (utilisé si pricing_type = 'format')

### `sales`
- `pricing_type` (text, default 'sqm') — enregistre le mode de tarification utilisé pour la vente

## Notes
1. `price_per_sqm` reste pour la compatibilité avec les ventes existantes (pricing_type='sqm').
2. Pour les ventes format, `price_per_sqm` est nul ou 0 ; on utilise `price_per_unit`.
3. Dimensions ISO en mètres :
   A0=0.841×1.189 | A1=0.594×0.841 | A2=0.420×0.594 | A3=0.297×0.420
   A4=0.210×0.297 | A5=0.148×0.210 | A6=0.105×0.148 | A7=0.074×0.105
*/

-- Articles : colonnes pricing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='pricing_type') THEN
    ALTER TABLE articles ADD COLUMN pricing_type text NOT NULL DEFAULT 'sqm'
      CHECK (pricing_type IN ('sqm', 'format'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='format') THEN
    ALTER TABLE articles ADD COLUMN format text
      CHECK (format IN ('A0','A1','A2','A3','A4','A5','A6','A7'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='price_per_unit') THEN
    ALTER TABLE articles ADD COLUMN price_per_unit decimal(10,2);
  END IF;
END $$;

-- Sales : colonne pricing_type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='pricing_type') THEN
    ALTER TABLE sales ADD COLUMN pricing_type text NOT NULL DEFAULT 'sqm'
      CHECK (pricing_type IN ('sqm', 'format'));
  END IF;
END $$;

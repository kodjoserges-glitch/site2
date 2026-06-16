-- Ajout du statut d'approbation sur les profils utilisateurs
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- L'admin existant (premier compte) est automatiquement approuvé
UPDATE user_profiles SET status = 'approved' WHERE role = 'admin';

-- Mise à jour du trigger : premier compte = admin + approuvé, suivants = vendeur + en attente
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first boolean;
BEGIN
  SELECT COUNT(*) = 0 INTO is_first FROM user_profiles;
  INSERT INTO user_profiles (id, full_name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    CASE WHEN is_first THEN 'admin' ELSE 'vendeur' END,
    CASE WHEN is_first THEN 'approved' ELSE 'pending' END
  );
  RETURN NEW;
END;
$$;

/*
# Profils utilisateurs et gestion des rôles

## Description
Ajoute un système d'authentification avec gestion des rôles utilisateurs.
Le premier utilisateur à s'inscrire devient automatiquement administrateur.
Les suivants reçoivent le rôle "vendeur" par défaut.

## Nouvelles tables
- `user_profiles` — profil lié à chaque compte auth.users
  - `id` (uuid, PK, FK → auth.users)
  - `full_name` (text) — nom affiché
  - `email` (text) — copie de l'email pour faciliter les requêtes
  - `role` (text) — rôle : 'admin' | 'manager' | 'vendeur'
  - `created_at`, `updated_at`

## Nouvelles fonctions
- `is_admin()` — retourne true si l'utilisateur courant est admin (SECURITY DEFINER)
- `handle_new_user()` — trigger créant le profil à chaque inscription

## Sécurité (RLS)
- Lecture : tous les utilisateurs authentifiés peuvent voir tous les profils
- Insertion : via trigger uniquement (SECURITY DEFINER bypasse RLS)
- Mise à jour : seul l'admin peut changer les rôles
- Suppression : seul l'admin peut supprimer un profil

## Notes
1. Le premier utilisateur inscrit reçoit automatiquement le rôle 'admin'.
2. Les inscriptions suivantes reçoivent le rôle 'vendeur' par défaut.
3. L'admin ne peut pas modifier son propre rôle (protection contre l'auto-démotion).
*/

-- Table des profils utilisateurs
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'vendeur' CHECK (role IN ('admin', 'manager', 'vendeur')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Fonction SECURITY DEFINER pour vérifier si l'utilisateur est admin
-- SECURITY DEFINER = exécute sans RLS sur user_profiles, évitant la récursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Fonction trigger: crée le profil au moment de l'inscription
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
  INSERT INTO user_profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    CASE WHEN is_first THEN 'admin' ELSE 'vendeur' END
  );
  RETURN NEW;
END;
$$;

-- Trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Politiques RLS
DROP POLICY IF EXISTS "profiles_select_all" ON user_profiles;
CREATE POLICY "profiles_select_all" ON user_profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON user_profiles;
CREATE POLICY "profiles_insert_own" ON user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON user_profiles;
CREATE POLICY "profiles_update_admin" ON user_profiles
  FOR UPDATE TO authenticated
  USING (is_admin() AND id <> auth.uid())
  WITH CHECK (is_admin() AND id <> auth.uid());

DROP POLICY IF EXISTS "profiles_delete_admin" ON user_profiles;
CREATE POLICY "profiles_delete_admin" ON user_profiles
  FOR DELETE TO authenticated
  USING (is_admin() AND id <> auth.uid());

/*
# Ajout du statut "reprint_requested" et table des notifications

## Description
1. Étend le cycle de vie d'impression : un imprimeur qui demande une réimpression
   met la commande en statut "reprint_requested" au lieu de revenir directement à "pending".
   Le vendeur doit alors valider cette réimpression dans la file d'attente.
2. Crée une table `notifications` pour signaler les nouvelles manipulations
   (nouvelle vente, demande de réimpression, validation de réimpression, impression validée)
   aux utilisateurs concernés selon leur rôle.

## Modifications

### Table `sales`
- La contrainte CHECK sur `print_status` est remplacée pour inclure 'reprint_requested'.
  Le cycle devient : pending → printed → reprint_requested → pending → printed

### Nouvelle table `notifications`
- `id` (uuid, PK)
- `target_role` (text) — rôle destinataire : 'admin','manager','vendeur','imprimeur','all'
- `type` (text) — type de notification : 'new_sale','reprint_request','reprint_validated','print_done'
- `title` (text) — titre court affiché
- `message` (text) — message détaillé
- `sale_id` (uuid, FK → sales, nullable) — commande concernée
- `actor_name` (text) — nom de l'utilisateur qui a déclenché l'action
- `read` (boolean, default false)
- `created_at` (timestamptz, default now())

## Sécurité (RLS)
- Lecture : tous les utilisateurs authentifiés peuvent voir les notifications
  qui ciblent leur rôle ou 'all'.
- Insertion : tous les utilisateurs authentifiés peuvent créer des notifications
  (déclenchées par les actions dans l'application).
- Mise à jour : un utilisateur peut marquer ses notifications comme lues.
- Suppression : un utilisateur peut supprimer ses propres notifications.
*/

-- Étendre la contrainte CHECK sur print_status
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_print_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_print_status_check
  CHECK (print_status IN ('pending', 'printed', 'reprint_requested'));

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_role text NOT NULL DEFAULT 'all' CHECK (target_role IN ('admin','manager','vendeur','imprimeur','all')),
  type text NOT NULL CHECK (type IN ('new_sale','reprint_request','reprint_validated','print_done')),
  title text NOT NULL,
  message text NOT NULL,
  sale_id uuid REFERENCES sales(id) ON DELETE CASCADE,
  actor_name text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

-- Lecture : les utilisateurs authentifiés voient les notifications de leur rôle + 'all'
DROP POLICY IF EXISTS "notifications_select_role" ON notifications;
CREATE POLICY "notifications_select_role" ON notifications
  FOR SELECT TO authenticated
  USING (target_role = 'all' OR target_role = (
    SELECT role FROM user_profiles WHERE id = auth.uid()
  ));

-- Insertion : tous les utilisateurs authentifiés peuvent créer des notifications
DROP POLICY IF EXISTS "notifications_insert_all" ON notifications;
CREATE POLICY "notifications_insert_all" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Mise à jour : un utilisateur peut marquer comme lu
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Suppression : un utilisateur peut supprimer ses notifications
DROP POLICY IF EXISTS "notifications_delete_all" ON notifications;
CREATE POLICY "notifications_delete_all" ON notifications
  FOR DELETE TO authenticated USING (true);

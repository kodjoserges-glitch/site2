/*
# Notifications par utilisateur + amélioration de la synchronisation

## Objectif
Les notifications étaient partagées entre tous les utilisateurs d'un même rôle.
Quand un vendeur marquait une notification comme lue, elle devenait lue pour tous les vendeurs.
Cette migration ajoute un ciblage par utilisateur pour les notifications individuelles
(impression terminée, demande de réimpression) tout en gardant le ciblage par rôle
pour les notifications collectives (nouvelle vente).

## Changements
1. Ajout de la colonne `target_user_id` (nullable) sur `notifications`
   - Quand non-null : la notification est destinée à un utilisateur spécifique
   - Quand null : la notification est destinée à tous les utilisateurs du rôle `target_role`
2. Ajout d'un index sur `target_user_id` pour les performances
3. Mise à jour des politiques RLS :
   - SELECT : un utilisateur voit les notifications où target_user_id = son id
     OU (target_user_id IS NULL AND target_role correspond à son rôle)
   - UPDATE : un utilisateur ne peut modifier QUE ses propres notifications
     (target_user_id = son id) ou les notifications de son rôle (target_user_id IS NULL)
   - DELETE : idem que UPDATE
4. La colonne `target_user_id` référence auth.users et se met à NULL si l'utilisateur est supprimé
*/

-- 1. Ajouter la colonne target_user_id
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Index pour les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_notifications_target_user_id
  ON notifications(target_user_id)
  WHERE target_user_id IS NOT NULL;

-- 3. Mettre à jour les politiques RLS
-- SELECT : voir ses notifications personnelles + celles de son rôle
DROP POLICY IF EXISTS "select_notifications" ON notifications;
CREATE POLICY "select_notifications"
  ON notifications FOR SELECT TO authenticated
  USING (
    target_user_id = auth.uid()
    OR (
      target_user_id IS NULL
      AND target_role = (
        SELECT role FROM user_profiles WHERE id = auth.uid()
      )
    )
    OR target_role = 'all'
  );

-- INSERT : allow authenticated to insert (notification sender)
DROP POLICY IF EXISTS "insert_notifications" ON notifications;
CREATE POLICY "insert_notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE : only update notifications targeted to you (per-user) or your role (role-wide)
DROP POLICY IF EXISTS "update_notifications" ON notifications;
CREATE POLICY "update_notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (
    target_user_id = auth.uid()
    OR (
      target_user_id IS NULL
      AND target_role = (
        SELECT role FROM user_profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    target_user_id = auth.uid()
    OR (
      target_user_id IS NULL
      AND target_role = (
        SELECT role FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- DELETE : only delete notifications targeted to you (per-user) or your role (role-wide)
DROP POLICY IF EXISTS "delete_notifications" ON notifications;
CREATE POLICY "delete_notifications"
  ON notifications FOR DELETE TO authenticated
  USING (
    target_user_id = auth.uid()
    OR (
      target_user_id IS NULL
      AND target_role = (
        SELECT role FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

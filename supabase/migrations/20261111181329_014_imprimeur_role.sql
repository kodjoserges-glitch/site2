/*
# Ajout du rôle "imprimeur"

## Description
Ajoute un nouveau rôle "imprimeur" au système de gestion des utilisateurs.
Ce rôle est destiné aux opérateurs d'impression qui n'ont accès qu'à la file d'attente.

## Modifications
- Table `user_profiles` : la contrainte CHECK sur la colonne `role` est remplacée
  pour inclure 'imprimeur' aux côtés de 'admin', 'manager', 'vendeur'.

## Sécurité
- Aucune modification des politiques RLS existantes.
- Le rôle 'imprimeur' hérite des mêmes règles d'accès que les autres rôles
  authentifiés (lecture des profils, etc.).
*/

-- Étendre la contrainte CHECK pour inclure 'imprimeur'
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'manager', 'vendeur', 'imprimeur'));

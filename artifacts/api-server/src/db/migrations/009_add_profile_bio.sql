-- Phase 20 : ajout du champ bio/statut pour le profil utilisateur.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio VARCHAR(150);

-- Phase 3 : table des utilisateurs (section 4 du cahier des charges).
-- pgcrypto fournit gen_random_uuid() pour des identifiants non devinables.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       VARCHAR(24) NOT NULL UNIQUE,
  display_name   VARCHAR(80) NOT NULL,
  phone_number   VARCHAR(20),
  avatar_url     TEXT,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_online      BOOLEAN NOT NULL DEFAULT false,

  -- Meme format que cote frontend (lib/authApi.ts) : lettres minuscules,
  -- chiffres, underscore, 3 a 24 caracteres.
  CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_]{3,24}$')
);

-- Recherche par identifiant : deja couverte par la contrainte UNIQUE
-- (qui cree un index), mais on force la casse pour eviter les doublons
-- "Moussa" / "moussa" au niveau applicatif plutot que base (la contrainte
-- UNIQUE porte sur la valeur telle que stockee ; l'application normalise
-- toujours en minuscules avant insertion, voir modules/auth).

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Phase 4 : table des contacts (section 4 et 6-7 du cahier des charges).
-- Une ligne = une relation orientee "user_id considere contact_user_id comme...".
-- status='accepted' couvre le cas MVP (ajout immediat, section 7 : "Afficher
-- ensuite le profil trouve" puis ajout direct, pas de flux d'acceptation a
-- deux etapes pour l'instant). status='pending' reste modelise pour une
-- evolution future (demande a valider par le destinataire) sans migration
-- supplementaire. status='blocked' correspond a la section 13/14 (blocage).
CREATE TABLE IF NOT EXISTS contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           VARCHAR(10) NOT NULL DEFAULT 'accepted',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT contacts_status_check CHECK (status IN ('accepted', 'pending', 'blocked')),
  CONSTRAINT contacts_no_self CHECK (user_id <> contact_user_id),
  -- Une seule relation par paire (user_id, contact_user_id) : un nouvel ajout
  -- apres suppression met a jour la ligne existante plutot que d'en creer une autre.
  CONSTRAINT contacts_unique_pair UNIQUE (user_id, contact_user_id)
);

-- Liste des contacts d'un utilisateur : la requete la plus frequente.
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);

-- Reutilise la fonction set_updated_at() creee en migration 001.
DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

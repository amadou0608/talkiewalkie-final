-- Phase 9 : notifications Web Push (section 4 et 11 du cahier des charges).
--
-- `push_token` stocke l'objet PushSubscription complet renvoye par le
-- navigateur (endpoint + cles p256dh/auth), en JSONB : c'est ce que la
-- librairie web-push attend tel quel pour envoyer une notification, pas
-- la peine de le redecouper en colonnes. `endpoint` est duplique en
-- colonne texte pour permettre un UNIQUE (un meme navigateur ne doit pas
-- creer plusieurs abonnements) et une suppression ciblee quand un
-- abonnement expire (voir push.service.ts, code 404/410).
CREATE TABLE IF NOT EXISTS devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  push_token    JSONB NOT NULL,
  platform      VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT devices_user_endpoint_unique UNIQUE (user_id, endpoint)
);

-- Recuperation de tous les abonnements d'un utilisateur au moment d'envoyer
-- une notification (push.repository.ts).
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

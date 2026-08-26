-- Phase 8 : messages vocaux hors ligne (section 4 et 10 du cahier des charges).
--
-- `storage_path` est volontairement un chemin RELATIF interne au serveur
-- (ex. "3f9c...-uuid.webm"), jamais une URL publique : la section 13
-- ("limitation des fichiers audio") et la section 14 (confidentialite)
-- impliquent qu'un vocal ne doit etre accessible qu'a l'expediteur et au
-- destinataire. L'acces passe donc toujours par la route authentifiee
-- GET /voice-messages/:id/audio (voir voice-messages.controller.ts), qui
-- verifie l'appartenance avant de streamer le fichier — jamais de lien
-- statique/devinable.
CREATE TABLE IF NOT EXISTS voice_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  size_bytes    INTEGER NOT NULL,
  duration_sec  INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Distinct de created_at : voir voice-messages.service.ts pour la decision
  -- MVP sur le moment ou un vocal est considere "delivre".
  delivered_at  TIMESTAMPTZ,
  listened_at   TIMESTAMPTZ,

  CONSTRAINT voice_messages_no_self CHECK (sender_id <> receiver_id),
  CONSTRAINT voice_messages_duration_check CHECK (duration_sec > 0 AND duration_sec <= 180),
  CONSTRAINT voice_messages_size_check CHECK (size_bytes > 0)
);

-- Boite de reception d'un utilisateur : requete la plus frequente (Messages.tsx).
CREATE INDEX IF NOT EXISTS idx_voice_messages_receiver ON voice_messages(receiver_id, created_at DESC);
-- Utile pour un futur "vocaux envoyes" (hors perimetre de cette phase, voir README).
CREATE INDEX IF NOT EXISTS idx_voice_messages_sender ON voice_messages(sender_id, created_at DESC);

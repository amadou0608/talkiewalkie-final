-- Phase 15 — métadonnée MIME pour servir les vocaux du fil de discussion.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS mime_type TEXT;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_voice_mime_check;
ALTER TABLE messages ADD CONSTRAINT messages_voice_mime_check CHECK (
  (type = 'voice' AND mime_type IS NOT NULL AND mime_type LIKE 'audio/%')
  OR type <> 'voice'
);

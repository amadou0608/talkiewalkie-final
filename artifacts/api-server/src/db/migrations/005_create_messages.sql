-- Phase 13 — préparation du système de messagerie complète.
-- Le modèle est volontairement créé avant les routes Socket.IO/API des phases 14+.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
    CREATE TYPE message_type AS ENUM ('text', 'voice', 'image', 'video');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
    CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type message_type NOT NULL,
  content TEXT,
  file_url TEXT,
  duration_sec INTEGER,
  status message_status NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT messages_sender_receiver_different CHECK (sender_id <> receiver_id),
  CONSTRAINT messages_text_content_check CHECK (
    (type = 'text' AND content IS NOT NULL AND length(btrim(content)) > 0)
    OR (type <> 'text')
  ),
  CONSTRAINT messages_file_url_check CHECK (
    (type IN ('voice', 'image', 'video') AND file_url IS NOT NULL)
    OR (type = 'text')
  ),
  CONSTRAINT messages_duration_check CHECK (
    (type IN ('voice', 'video') AND duration_sec IS NOT NULL AND duration_sec > 0)
    OR (type IN ('text', 'image') AND duration_sec IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
  ON messages (sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_status_created_at
  ON messages (receiver_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
  ON messages (deleted_at)
  WHERE deleted_at IS NOT NULL;

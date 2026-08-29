-- Phase X : historique des versions pour l'édition de messages
CREATE TABLE IF NOT EXISTS message_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  previous_content TEXT,
  previous_file_url TEXT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_edit_history_message_id
  ON message_edit_history (message_id, edited_at DESC);

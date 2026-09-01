ALTER TABLE messages ADD COLUMN disappear_after_sec integer;
ALTER TABLE messages ADD COLUMN delete_at timestamptz;
CREATE INDEX idx_messages_delete_at ON messages (delete_at) WHERE delete_at IS NOT NULL;

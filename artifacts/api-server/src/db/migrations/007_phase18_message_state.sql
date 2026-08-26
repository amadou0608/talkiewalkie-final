-- Phase 18: read state, editing/deletion, and conversation previews/unread counts.
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread_created_at
  ON messages (receiver_id, created_at DESC)
  WHERE status <> 'read' AND deleted_at IS NULL;

-- Phase 19: allow deleted messages to clear their payload.
--
-- Deleting a message keeps its row as a tombstone so replicas and connected
-- clients can receive the deletion event. The payload is cleared by
-- messages.service.ts, so the content/file constraints must allow NULL values
-- once deleted_at is set.
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_text_content_check,
  DROP CONSTRAINT IF EXISTS messages_file_url_check,
  DROP CONSTRAINT IF EXISTS messages_duration_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_text_content_check CHECK (
    deleted_at IS NOT NULL
    OR (
      (type = 'text' AND content IS NOT NULL AND length(btrim(content)) > 0)
      OR type <> 'text'
    )
  ),
  ADD CONSTRAINT messages_file_url_check CHECK (
    deleted_at IS NOT NULL
    OR (
      (type IN ('voice', 'image', 'video') AND file_url IS NOT NULL)
      OR type = 'text'
    )
  ),
  ADD CONSTRAINT messages_duration_check CHECK (
    deleted_at IS NOT NULL
    OR (
      (type IN ('voice', 'video') AND duration_sec IS NOT NULL AND duration_sec > 0)
      OR type IN ('text', 'image')
    )
  );
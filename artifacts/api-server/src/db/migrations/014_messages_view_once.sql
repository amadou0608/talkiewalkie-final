ALTER TABLE messages ADD COLUMN view_once boolean NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN consumed_at timestamptz;

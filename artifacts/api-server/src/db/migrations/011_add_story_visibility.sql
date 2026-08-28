-- Migration 011: Confidentialité des stories

ALTER TABLE stories
  ADD COLUMN visibility_mode TEXT NOT NULL DEFAULT 'all';
-- valeurs possibles : 'all' (tout le monde), 'except' (tout le monde sauf...), 'only' (seulement...)

CREATE TABLE story_visibility_list (
  id SERIAL PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

CREATE INDEX idx_story_visibility_list_story_id ON story_visibility_list(story_id);

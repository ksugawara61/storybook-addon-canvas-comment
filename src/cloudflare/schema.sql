CREATE TABLE IF NOT EXISTS canvas_comments (
  id TEXT PRIMARY KEY NOT NULL,
  story_id TEXT NOT NULL,
  story_title TEXT NOT NULL,
  story_name TEXT NOT NULL,
  note TEXT NOT NULL,
  selector TEXT NOT NULL,
  data_test_id TEXT,
  data_ai_component TEXT,
  data_ai_source TEXT,
  rect TEXT NOT NULL,
  pointer TEXT NOT NULL,
  viewport TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  dom_context TEXT
);

CREATE INDEX IF NOT EXISTS idx_canvas_comments_story_id ON canvas_comments (story_id);
CREATE INDEX IF NOT EXISTS idx_canvas_comments_status ON canvas_comments (status);

CREATE TABLE IF NOT EXISTS canvas_comment_replies (
  id TEXT PRIMARY KEY NOT NULL,
  comment_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canvas_comment_replies_comment_id ON canvas_comment_replies (comment_id);

CREATE TABLE IF NOT EXISTS review_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'reviewing',
  updated_at TEXT
);

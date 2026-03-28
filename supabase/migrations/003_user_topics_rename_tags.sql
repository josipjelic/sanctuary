-- Migration: 003_user_topics_rename_tags
-- Description: Per-user topics catalog, thought_topics junction, rename thoughts.tags -> topics
-- Date: 2026-03-28

-- ---------------------------------------------------------------------------
-- user_topics
-- ---------------------------------------------------------------------------

CREATE TABLE user_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_topics_user_normalized_unique UNIQUE (user_id, normalized_name)
);

CREATE INDEX idx_user_topics_user_id ON user_topics (user_id);

ALTER TABLE user_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topics"
  ON user_topics FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own topics"
  ON user_topics FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own topics"
  ON user_topics FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own topics"
  ON user_topics FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- thought_topics (before renaming thoughts.tags)
-- ---------------------------------------------------------------------------

CREATE TABLE thought_topics (
  thought_id uuid NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES user_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (thought_id, topic_id)
);

CREATE INDEX idx_thought_topics_thought ON thought_topics (thought_id);
CREATE INDEX idx_thought_topics_topic ON thought_topics (topic_id);

ALTER TABLE thought_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own thought_topics"
  ON thought_topics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM thoughts t
      WHERE t.id = thought_topics.thought_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own thought_topics"
  ON thought_topics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM thoughts t
      WHERE t.id = thought_topics.thought_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own thought_topics"
  ON thought_topics FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM thoughts t
      WHERE t.id = thought_topics.thought_id AND t.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill from legacy tags[]
-- ---------------------------------------------------------------------------

INSERT INTO user_topics (user_id, name, normalized_name)
SELECT DISTINCT ON (t.user_id, lower(trim(both u.tag)))
  t.user_id,
  trim(both u.tag),
  lower(trim(both u.tag))
FROM thoughts t
CROSS JOIN LATERAL unnest(t.tags) AS u(tag)
WHERE length(trim(both u.tag)) > 0
ORDER BY t.user_id, lower(trim(both u.tag)), trim(both u.tag)
ON CONFLICT ON CONSTRAINT user_topics_user_normalized_unique DO NOTHING;

INSERT INTO thought_topics (thought_id, topic_id)
SELECT DISTINCT t.id, ut.id
FROM thoughts t
CROSS JOIN LATERAL unnest(t.tags) AS u(tag)
JOIN user_topics ut
  ON ut.user_id = t.user_id AND ut.normalized_name = lower(trim(both u.tag))
WHERE length(trim(both u.tag)) > 0
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Rename tags -> topics and refresh denormalized array from junction
-- ---------------------------------------------------------------------------

ALTER INDEX idx_thoughts_tags RENAME TO idx_thoughts_topics;

ALTER TABLE thoughts RENAME COLUMN tags TO topics;

UPDATE thoughts te
SET topics = COALESCE(sub.arr, '{}')
FROM (
  SELECT tt.thought_id, array_agg(ut.name ORDER BY ut.name) AS arr
  FROM thought_topics tt
  JOIN user_topics ut ON ut.id = tt.topic_id
  GROUP BY tt.thought_id
) sub
WHERE te.id = sub.thought_id;

UPDATE thoughts
SET topics = '{}'
WHERE NOT EXISTS (
  SELECT 1 FROM thought_topics tt WHERE tt.thought_id = thoughts.id
);

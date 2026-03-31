-- Migration: 004_reminders
-- Description: Create reminders and user_preferences tables; add reminder_detection_status to thoughts
-- Date: 2026-03-30
-- Reversible: Yes (see rollback section at the bottom)
-- Deployment risk: Low — two new tables (no locking of existing tables) + additive column on thoughts

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------

CREATE TABLE reminders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thought_id      uuid        NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  extracted_text  text        NOT NULL,
  scheduled_at    timestamptz NOT NULL,
  lead_time       integer,
  status          text        NOT NULL DEFAULT 'inactive',
  notification_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Restrict status to defined lifecycle values. CHECK is used rather than a
  -- PostgreSQL ENUM so that adding new values in a future migration requires
  -- only ALTER TABLE ... ADD CHECK, avoiding the exclusive lock that ALTER
  -- TYPE demands.
  CONSTRAINT reminders_status_check
    CHECK (status IN ('inactive', 'active', 'dismissed', 'sent'))
);

-- B-tree on user_id alone: supports existence checks and full user-scoped
-- queries without a status or thought filter.
CREATE INDEX idx_reminders_user_id
  ON reminders (user_id);

-- B-tree on thought_id: supports fetching all reminders for a given thought
-- (e.g. showing the reminder chip on the thought detail screen).
CREATE INDEX idx_reminders_thought_id
  ON reminders (thought_id);

-- Composite B-tree on (user_id, status): covers the primary query pattern —
-- fetch all reminders in a given status for a user (e.g. all 'inactive'
-- reminders awaiting approval). Equality on user_id first, then status.
CREATE INDEX idx_reminders_user_status
  ON reminders (user_id, status);

-- ---------------------------------------------------------------------------
-- Row Level Security — reminders
-- ---------------------------------------------------------------------------

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
  ON reminders
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reminders"
  ON reminders
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reminders"
  ON reminders
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own reminders"
  ON reminders
  FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- user_preferences
-- ---------------------------------------------------------------------------

CREATE TABLE user_preferences (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         text        NOT NULL,
  value       jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- One value per preference key per user. Application code should use
  -- ON CONFLICT (user_id, key) DO UPDATE to implement upsert behaviour.
  CONSTRAINT user_preferences_user_key_unique UNIQUE (user_id, key)
);

-- B-tree on user_id: covers the common pattern of loading all preferences
-- for a user in one query (small result set, equality predicate).
CREATE INDEX idx_user_preferences_user_id
  ON user_preferences (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — user_preferences
-- ---------------------------------------------------------------------------

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_preferences
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON user_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON user_preferences
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own preferences"
  ON user_preferences
  FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Add reminder_detection_status to thoughts
-- ---------------------------------------------------------------------------

-- Additive column — takes a default, no table rewrite required.
-- Mirrors the existing transcription_status and tagging_status pattern.
ALTER TABLE thoughts
  ADD COLUMN IF NOT EXISTS reminder_detection_status text NOT NULL DEFAULT 'none';

ALTER TABLE thoughts
  ADD CONSTRAINT thoughts_reminder_detection_status_check
    CHECK (reminder_detection_status IN ('none', 'pending', 'complete', 'failed'));

-- ---------------------------------------------------------------------------
-- Rollback DDL
-- Note: dropping these tables and the column is destructive if data exists.
-- Only run in a development or test environment, or when explicitly approved.
-- ---------------------------------------------------------------------------
-- ALTER TABLE thoughts DROP CONSTRAINT IF EXISTS thoughts_reminder_detection_status_check;
-- ALTER TABLE thoughts DROP COLUMN IF EXISTS reminder_detection_status;
-- DROP TABLE IF EXISTS user_preferences;
-- DROP TABLE IF EXISTS reminders;

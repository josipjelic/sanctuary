-- Migration: 007_journal
-- Description: Create journal_sessions, journal_entries, and user_state tables
--              for the AI-Guided Journal subsystem (ADR-006)
-- Date: 2026-04-12
-- Reversible: Yes (see rollback section at the bottom)
-- Deployment risk: Low — three new tables only (no locking of existing tables,
--                  no changes to existing tables or data)

-- ---------------------------------------------------------------------------
-- journal_sessions
-- ---------------------------------------------------------------------------
-- One row per journal session (a single sitting of the AI-guided journal flow).
-- Rows are inserted when the user opens the Journal tab (status: 'pending').
-- 'pending' sessions within 24 hours are offered as resume candidates.
-- 'completed' is set by journal-save-session when the user saves.
-- 'abandoned' is set when the user taps "Start fresh" (old session superseded).
--
-- CHECK uses text + CHECK rather than a PostgreSQL ENUM so that adding new
-- lifecycle values in future requires only ALTER TABLE ... ADD CHECK — not
-- ALTER TYPE, which demands an exclusive lock.
--
-- opening_question_version tracks which JOURNAL_OPENING_QUESTION_V* constant
-- was displayed to the user in this session, enabling future A/B testing of
-- the opening question without invalidating historical sessions.

CREATE TABLE journal_sessions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                   text        NOT NULL DEFAULT 'pending',
  opening_question_version text        NOT NULL DEFAULT 'v1',
  started_at               timestamptz NOT NULL DEFAULT now(),
  completed_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT journal_sessions_status_check
    CHECK (status IN ('pending', 'completed', 'abandoned'))
);

-- Composite B-tree on (user_id, started_at DESC): covers the two primary query
-- patterns — (1) resume detection (filter by user + status + recency), and
-- (2) journal history screen (filter by user, sort newest-first).
-- Column order: equality predicate on user_id first, then range/sort on
-- started_at. DESC matches the ORDER BY direction, eliminating a sort step
-- on the most common read path.
CREATE INDEX idx_journal_sessions_user_started
  ON journal_sessions (user_id, started_at DESC);

-- Partial B-tree on (user_id, status) for pending sessions only: used
-- exclusively by the resume-detection query on Journal tab open.
-- The partial index excludes completed and abandoned rows (the large majority
-- at steady state), keeping it small and fast.
CREATE INDEX idx_journal_sessions_user_pending
  ON journal_sessions (user_id, status)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Row Level Security — journal_sessions
-- ---------------------------------------------------------------------------

ALTER TABLE journal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal sessions"
  ON journal_sessions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own journal sessions"
  ON journal_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own journal sessions"
  ON journal_sessions
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own journal sessions"
  ON journal_sessions
  FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------------
-- One row per question-answer turn within a session (max 3 turns: turn_index
-- 0, 1, 2). Rows are written incrementally per ADR-006 Decision 4:
--   - Row created (answer = NULL) when the question is displayed to the user
--   - Row updated (answer + answered_at set) when the user submits their answer
-- This enables genuine session resume after app kill — any answered turn is
-- already persisted and can be reloaded.
--
-- user_id is denormalized from the parent session so that RLS policies on this
-- table can use the simple user_id = auth.uid() pattern without a JOIN to
-- journal_sessions on every query. The application must always set user_id to
-- match the session's user_id when inserting.
--
-- UNIQUE (session_id, turn_index) prevents duplicate turns within a session
-- and makes the entry row idempotent on insert (ON CONFLICT DO UPDATE).
-- CHECK on turn_index enforces the 3-turn maximum at the DB level as a
-- backstop behind the server-authoritative enforcement in journal-next-question.

CREATE TABLE journal_entries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES journal_sessions(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_index   smallint    NOT NULL,
  question     text        NOT NULL,
  answer       text,
  answered_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT journal_entries_session_turn_unique
    UNIQUE (session_id, turn_index),

  -- DB-level backstop on the 3-turn maximum. turn_index is 0-based: 0 =
  -- opening question, 1 = first follow-up, 2 = second follow-up.
  CONSTRAINT journal_entries_turn_index_range
    CHECK (turn_index >= 0 AND turn_index <= 2)
);

-- Composite B-tree on (session_id, turn_index): covers the primary read
-- pattern — load all Q&A pairs for a session in turn order. The UNIQUE
-- constraint already creates an implicit index covering this pair, but the
-- named explicit index enables independent monitoring via pg_stat_user_indexes.
-- Note: because the UNIQUE constraint index covers (session_id, turn_index),
-- this additional index is technically redundant but is created per the
-- project convention of naming all significant indexes explicitly.
CREATE INDEX idx_journal_entries_session_turn
  ON journal_entries (session_id, turn_index);

-- ---------------------------------------------------------------------------
-- Row Level Security — journal_entries
-- ---------------------------------------------------------------------------

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entries"
  ON journal_entries
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own journal entries"
  ON journal_entries
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own journal entries"
  ON journal_entries
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own journal entries"
  ON journal_entries
  FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- user_state
-- ---------------------------------------------------------------------------
-- One row per user. Stores the living ~200-word third-person analysis that
-- accumulates patterns and themes from all completed journal sessions.
-- This analysis is passed as read-only context to journal-next-question and
-- is readable by the user on their "Your profile" screen in Settings.
--
-- content is nullable: NULL until the first journal session is completed.
-- The upsert pattern is: ON CONFLICT ON CONSTRAINT user_state_user_id_unique
-- DO UPDATE SET content = ..., session_count = ..., updated_at = now().
--
-- last_session_id is a nullable FK back to journal_sessions, kept as a
-- debugging correlation — it identifies the most recent session whose content
-- was merged into this analysis. ON DELETE SET NULL so that deleting a session
-- (e.g. in a test environment) does not orphan the user_state row.
--
-- word_count is an approximate count of words in content, maintained by the
-- edge function for operational monitoring (ensures the analysis stays near
-- the 200-word target and does not drift).
--
-- session_count tracks how many completed sessions have contributed to this
-- analysis; displayed on the "Your profile" screen.

CREATE TABLE user_state (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content          text,
  word_count       smallint,
  session_count    integer     NOT NULL DEFAULT 0,
  last_session_id  uuid        REFERENCES journal_sessions(id) ON DELETE SET NULL,
  last_updated_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- One state row per user. Enables efficient upsert via:
  --   ON CONFLICT ON CONSTRAINT user_state_user_id_unique DO UPDATE ...
  CONSTRAINT user_state_user_id_unique UNIQUE (user_id)
);

-- No additional indexes: user_state is accessed exclusively by user_id point
-- lookup, which is already covered by the UNIQUE constraint's implicit index.
-- The idx_user_state_user_id below is created explicitly for naming
-- consistency and independent monitoring, matching the pattern used for
-- ocean_profiles (idx_ocean_profiles_user_id).
CREATE INDEX idx_user_state_user_id
  ON user_state (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — user_state
-- ---------------------------------------------------------------------------

ALTER TABLE user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user state"
  ON user_state
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own user state"
  ON user_state
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own user state"
  ON user_state
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own user state"
  ON user_state
  FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- user_preferences: new keys (no schema change — table already exists)
-- ---------------------------------------------------------------------------
-- The following keys are added to the existing user_preferences key-value table
-- by the mobile client and edge functions. No DDL change required.
--
--   evening_notification_time
--     Type:    JSON string "HH:MM"
--     Default: "21:00" (applied in mobile app logic, not DB)
--     Purpose: User-configured time for the nightly journal reminder.
--     Example: INSERT INTO user_preferences (user_id, key, value)
--              VALUES (auth.uid(), 'evening_notification_time', '"21:00"'::jsonb)
--              ON CONFLICT ON CONSTRAINT user_preferences_user_key_unique
--              DO UPDATE SET value = EXCLUDED.value, updated_at = now();
--
--   evening_notification_id
--     Type:    JSON string (expo-notifications identifier)
--     Default: NULL / absent until the user enables the evening reminder
--     Purpose: The identifier returned by expo-notifications
--              scheduleNotificationAsync for the recurring DailyTriggerInput
--              evening reminder. Stored so the mobile client can cancel or
--              reschedule the notification when the time preference changes.
--     Example: INSERT INTO user_preferences (user_id, key, value)
--              VALUES (auth.uid(), 'evening_notification_id', '"<expo-id>"'::jsonb)
--              ON CONFLICT ON CONSTRAINT user_preferences_user_key_unique
--              DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
-- Note: No trigger-based updated_at maintenance is added here. The existing
-- schema convention (established in migrations 001–006) is to set updated_at
-- explicitly in UPDATE statements at the application/edge-function layer.
-- journal_sessions and user_state follow this same convention.

-- ---------------------------------------------------------------------------
-- Rollback DDL
-- Note: dropping these tables is destructive if production data exists.
-- Only run in a development or test environment, or when explicitly approved.
-- Rollback order: entries → sessions first (FK dependency), then user_state.
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS journal_entries;
-- DROP TABLE IF EXISTS user_state;
-- DROP TABLE IF EXISTS journal_sessions;

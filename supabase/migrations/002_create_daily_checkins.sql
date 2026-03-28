-- Migration: 002_create_daily_checkins
-- Description: Create daily_checkins table with unique constraint, index, and RLS policies
-- Date: 2026-03-28
-- Reversible: Yes (see rollback section at the bottom)
-- Deployment risk: None — new table creation, no locking of existing tables

-- ---------------------------------------------------------------------------
-- Forward DDL
-- ---------------------------------------------------------------------------

CREATE TABLE daily_checkins (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in_date  date        NOT NULL,
  mood           text,
  intention      text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- One check-in row per user per calendar day. Enforced at the database
  -- level so concurrent inserts from multiple devices cannot create
  -- duplicates. Application code should use ON CONFLICT (user_id,
  -- check_in_date) DO UPDATE to implement upsert behaviour.
  CONSTRAINT daily_checkins_user_date_unique UNIQUE (user_id, check_in_date)
);

-- Composite B-tree on (user_id, check_in_date DESC): covers the primary
-- history query — filter by user, sort most-recent-first. Also serves the
-- single-row lookup for today's check-in (equality on both columns).
-- The UNIQUE constraint above creates its own index on (user_id,
-- check_in_date ASC); this explicit index adds the DESC direction for
-- efficient ORDER BY check_in_date DESC queries without a sort step.
CREATE INDEX idx_daily_checkins_user_date
  ON daily_checkins (user_id, check_in_date DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own check-ins"
  ON daily_checkins
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own check-ins"
  ON daily_checkins
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own check-ins"
  ON daily_checkins
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own check-ins"
  ON daily_checkins
  FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Rollback DDL
-- Note: dropping this table is destructive if data exists. Only run in a
-- development or test environment, or when explicitly approved.
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS daily_checkins;

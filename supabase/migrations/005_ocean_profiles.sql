-- Migration: 005_ocean_profiles
-- Description: Create ocean_profiles and morning_messages tables for the OCEAN personality onboarding subsystem
-- Date: 2026-04-11
-- Reversible: Yes (see rollback section at the bottom)
-- Deployment risk: Low — two new tables only (no locking of existing tables, no existing data affected)

-- ---------------------------------------------------------------------------
-- ocean_profiles
-- ---------------------------------------------------------------------------
-- UNIQUE (user_id) enables zero-friction upsert with:
--   ON CONFLICT ON CONSTRAINT ocean_profiles_user_id_unique DO UPDATE ...
-- This allows re-taking the onboarding quiz to overwrite scores without
-- deleting the existing row and losing the scored_at/created_at audit trail.

CREATE TABLE ocean_profiles (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  openness              real        NOT NULL,
  conscientiousness     real        NOT NULL,
  extraversion          real        NOT NULL,
  agreeableness         real        NOT NULL,
  neuroticism           real        NOT NULL,
  answers               jsonb       NOT NULL,
  question_set_version  text        NOT NULL DEFAULT 'v1',
  scored_at             timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- One profile per user. Enables efficient upsert when a user re-takes
  -- the onboarding quiz (ON CONFLICT ON CONSTRAINT ocean_profiles_user_id_unique).
  CONSTRAINT ocean_profiles_user_id_unique UNIQUE (user_id),

  -- OCEAN scores are floats in [0.0, 1.0] as returned by the AI scoring model.
  -- CHECK constraints are applied per-column rather than as a single composite
  -- constraint so that violation messages name the failing dimension.
  CONSTRAINT ocean_profiles_openness_range
    CHECK (openness >= 0.0 AND openness <= 1.0),
  CONSTRAINT ocean_profiles_conscientiousness_range
    CHECK (conscientiousness >= 0.0 AND conscientiousness <= 1.0),
  CONSTRAINT ocean_profiles_extraversion_range
    CHECK (extraversion >= 0.0 AND extraversion <= 1.0),
  CONSTRAINT ocean_profiles_agreeableness_range
    CHECK (agreeableness >= 0.0 AND agreeableness <= 1.0),
  CONSTRAINT ocean_profiles_neuroticism_range
    CHECK (neuroticism >= 0.0 AND neuroticism <= 1.0)
);

-- B-tree on user_id: the UNIQUE constraint already creates an implicit index,
-- but we name it explicitly for monitoring via pg_stat_user_indexes.
-- Note: the UNIQUE constraint index (ocean_profiles_user_id_unique) covers
-- all equality lookups on user_id — a separate idx_ocean_profiles_user_id
-- would be redundant. We create it anyway for naming consistency with the
-- rest of the schema and to allow independent monitoring.
CREATE INDEX idx_ocean_profiles_user_id
  ON ocean_profiles (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — ocean_profiles
-- ---------------------------------------------------------------------------

ALTER TABLE ocean_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ocean profiles"
  ON ocean_profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own ocean profiles"
  ON ocean_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own ocean profiles"
  ON ocean_profiles
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own ocean profiles"
  ON ocean_profiles
  FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- morning_messages
-- ---------------------------------------------------------------------------

CREATE TABLE morning_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_for_date  date        NOT NULL,
  message             text        NOT NULL,
  shown_at            timestamptz,
  dismissed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- One message per user per calendar day. The edge function generating
  -- morning messages uses ON CONFLICT on this constraint to avoid duplicates
  -- if called more than once for the same day.
  CONSTRAINT morning_messages_user_date_unique UNIQUE (user_id, generated_for_date)
);

-- Composite B-tree on (user_id, generated_for_date DESC): covers the primary
-- query pattern — fetch the most recent morning message for a user, or a
-- range of recent dates. DESC matches the ORDER BY direction so no sort step
-- is required.
CREATE INDEX idx_morning_messages_user_date
  ON morning_messages (user_id, generated_for_date DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security — morning_messages
-- ---------------------------------------------------------------------------

ALTER TABLE morning_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own morning messages"
  ON morning_messages
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own morning messages"
  ON morning_messages
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own morning messages"
  ON morning_messages
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own morning messages"
  ON morning_messages
  FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Rollback DDL
-- Note: dropping these tables is destructive if data exists.
-- Only run in a development or test environment, or when explicitly approved.
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS morning_messages;
-- DROP TABLE IF EXISTS ocean_profiles;

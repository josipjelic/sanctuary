-- Migration: 001_create_thoughts
-- Description: Create thoughts table with indexes and RLS policies
-- Date: 2026-03-28
-- Reversible: Yes (see rollback section at the bottom)
-- Deployment risk: None — new table creation, no locking of existing tables

-- ---------------------------------------------------------------------------
-- Forward DDL
-- ---------------------------------------------------------------------------

CREATE TABLE thoughts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body                  text        NOT NULL,
  body_extended         text,
  tags                  text[]      NOT NULL DEFAULT '{}',
  has_audio             boolean     NOT NULL DEFAULT false,
  transcription_status  text        NOT NULL DEFAULT 'none',
  tagging_status        text        NOT NULL DEFAULT 'none',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Restrict status columns to the defined lifecycle values.
  -- Using CHECK constraints rather than a PostgreSQL ENUM type so that adding
  -- new status values in a future migration is a simple ALTER TABLE ... ADD
  -- CHECK rather than an ALTER TYPE, which requires an exclusive lock.
  CONSTRAINT thoughts_transcription_status_check
    CHECK (transcription_status IN ('none', 'pending', 'complete', 'failed')),
  CONSTRAINT thoughts_tagging_status_check
    CHECK (tagging_status IN ('none', 'pending', 'complete', 'failed'))
);

-- B-tree index on user_id alone: used when fetching a count or existence check
-- for a user without a date filter (e.g. "does this user have any thoughts?").
CREATE INDEX idx_thoughts_user_id
  ON thoughts (user_id);

-- Composite B-tree on (user_id, created_at DESC): covers the primary inbox
-- query pattern — filter by user, sort newest-first. Column order is
-- intentional: equality predicate on user_id first, then range/sort on
-- created_at. This index makes idx_thoughts_user_id redundant for most
-- queries but the single-column index is kept for any user_id-only lookups.
CREATE INDEX idx_thoughts_created_at
  ON thoughts (user_id, created_at DESC);

-- GIN index on the tags array: enables efficient containment queries using
-- the @> operator (e.g. WHERE tags @> ARRAY['grocery']). A B-tree index
-- cannot be used for array containment — GIN is the correct type here.
CREATE INDEX idx_thoughts_tags
  ON thoughts USING GIN (tags);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;

-- Each policy is scoped to auth.uid() so users can only read and write their
-- own rows. The RLS check is enforced at the PostgreSQL level — not the
-- application layer — so it cannot be bypassed by a buggy query.

CREATE POLICY "Users can view own thoughts"
  ON thoughts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own thoughts"
  ON thoughts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own thoughts"
  ON thoughts
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own thoughts"
  ON thoughts
  FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Rollback DDL
-- Note: dropping this table is destructive if data exists. Only run in a
-- development or test environment, or when explicitly approved.
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS thoughts;

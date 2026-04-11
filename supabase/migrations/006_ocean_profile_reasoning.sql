-- Migration: 006_ocean_profile_reasoning
-- Description: Add per-dimension AI reasoning to ocean_profiles
-- Date: 2026-04-11
-- Reversible: Yes (see rollback at bottom)

-- Add a nullable JSONB column so existing rows are unaffected.
-- Shape: { "openness": "...", "conscientiousness": "...", ... }
ALTER TABLE ocean_profiles
  ADD COLUMN IF NOT EXISTS reasoning jsonb;

-- Rollback:
-- ALTER TABLE ocean_profiles DROP COLUMN IF EXISTS reasoning;

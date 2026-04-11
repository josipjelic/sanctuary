---
id: "039"
title: "OCEAN onboarding: database schema"
status: "completed"
area: "database"
agent: "@database-expert"
priority: "high"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-11"
completed_at: "2026-04-11"
prd_refs: ["FR-060"]
blocks: ["040"]
blocked_by: ["037"]
---

## Description

Create the user_ocean_profiles table and migration 005.

Table: user_ocean_profiles
- user_id (uuid, FK -> auth.users.id, ON DELETE CASCADE)
- openness (smallint, 0-100)
- conscientiousness (smallint, 0-100)
- extraversion (smallint, 0-100)
- agreeableness (smallint, 0-100)
- neuroticism (smallint, 0-100)
- raw_answers (jsonb) — stores 5-7 Q&A pairs for transparency/re-scoring
- scored_at (timestamptz)
- created_at, updated_at

RLS: full CRUD where user_id = auth.uid()

## Acceptance Criteria

- [x] supabase/migrations/005_ocean_profiles.sql created
- [x] RLS policies for all four operations
- [x] docs/technical/DATABASE.md updated with new table section
- [x] UNIQUE constraint on user_id (one profile per user)

## Technical Notes

- Follow migration patterns from 004_reminders.sql
- Include rollback DDL comment at the end of the migration file
- Use ON CONFLICT for upsert capability (re-taking onboarding)

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created via orchestration |
| 2026-04-11 | @database-expert | Created `005_ocean_profiles.sql` with `ocean_profiles` and `morning_messages` tables, full RLS policies, indexes, and rollback DDL. Updated `DATABASE.md` (schema diagram, table sections, migrations log, query patterns). |

---
id: "001"
title: "Design database schema (thoughts, tags, daily_checkins)"
status: "completed"
area: "database"
agent: "@database-expert"
priority: "high"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: "2026-03-28"
prd_refs: ["FR-010", "FR-013", "FR-015", "FR-016", "FR-020", "FR-040", "FR-042", "FR-043"]
blocks: ["003"]
blocked_by: []
---

## Description

Design and document the complete PostgreSQL schema for Sanctuary's core data model. The schema must cover: the `thoughts` table (capturing text, transcription status, tags, and optional audio path), and the `daily_checkins` table (one per user per calendar day with mood and intention). All tables must have RLS policies that restrict access to the owning user. The schema design should reference `docs/technical/DATABASE.md` and fill in the full table definitions, indexes, and migration plan.

## Acceptance Criteria

- [x] `thoughts` table schema fully defined with all columns, types, constraints, and indexes
- [x] `daily_checkins` table schema fully defined with UNIQUE constraint on `(user_id, check_in_date)`
- [x] RLS policies specified for all tables (SELECT, INSERT, UPDATE, DELETE)
- [x] Migration files drafted (`.sql` or Supabase migration format)
- [x] `docs/technical/DATABASE.md` updated with final schema
- [x] Schema reviewed against FR-010 through FR-043 requirements

## Technical Notes

- Use `auth.users.id` as the FK target for `user_id` columns (Supabase Auth managed table)
- Tags stored as `text[]` array on `thoughts` table — no separate tags table needed for v1
- Consider a GIN index on `tags` for efficient `@>` (contains) queries
- `transcription_status` and `tagging_status` enum-like columns: `'none'`, `'pending'`, `'complete'`, `'failed'`
- See `docs/technical/DATABASE.md` for the agreed schema draft — validate and finalize it

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |
| 2026-03-28 | @database-expert | Migration files written: 001_create_thoughts.sql, 002_create_daily_checkins.sql. DATABASE.md migrations log updated. Task marked complete. |

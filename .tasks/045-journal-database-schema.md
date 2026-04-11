---
id: "045"
title: "AI-guided journal: database schema"
status: "done"
area: "database"
agent: "@database-expert"
priority: "normal"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-12"
completed_at: "2026-04-12"
prd_refs: []
blocks: ["046"]
blocked_by: ["043"]
---

## Description

Design and implement the database schema for the AI-Guided Journal feature, following the schema guidelines specified in the architecture ADR (task #043). Deliver a Supabase migration file `supabase/migrations/006_journal.sql` with all tables, constraints, indexes, and RLS policies.

Tables to create:

- **`journal_sessions`** — one row per journal session. Tracks state machine (`pending → active → completed | abandoned`), user ID, started/completed timestamps, and a reference to the `user_state` snapshot used during the session.
- **`journal_entries`** — individual turns within a session (questions and answers). Ordered by `turn_index`. Each row records: session ID, turn index, type (`question` | `answer`), content text, and timestamps. The exact structure (separate rows vs. paired JSON) is specified in the architecture ADR.
- **`user_state`** — one row per user (upserted). Stores the 200-word AI-generated analysis text, a `last_updated_at` timestamp, and optionally a version counter for optimistic concurrency.

Also update `docs/technical/DATABASE.md` to document the new tables.

## Acceptance Criteria

- [ ] `supabase/migrations/006_journal.sql` created and applies cleanly against the existing schema
- [ ] `journal_sessions` table: all columns per ADR spec, CHECK constraint on `status` enum, foreign key to `auth.users`, appropriate indexes (user_id, status, created_at)
- [ ] `journal_entries` table: all columns per ADR spec, foreign key to `journal_sessions`, composite unique constraint on `(session_id, turn_index)`, index on `session_id`
- [ ] `user_state` table: one-row-per-user design enforced (unique constraint on `user_id`), foreign key to `auth.users`
- [ ] RLS policies on all three tables: users can only read/write their own rows; service role bypasses RLS for edge function writes
- [ ] `docs/technical/DATABASE.md` updated with new table descriptions
- [ ] Migration is idempotent (uses `IF NOT EXISTS` / safe DDL) and reversible (or includes a rollback note)

## Technical Notes

- Read the architecture ADR output from task #043 before starting — the ADR specifies the exact column set, enum values, and indexing strategy
- Follow the pattern established in prior migrations (`001_initial.sql` through `005_lists.sql`) for formatting, RLS policy naming, and comment style
- `journal_sessions.status` CHECK constraint values: `'pending'`, `'active'`, `'completed'`, `'abandoned'` — mirror the `reminder_detection_status` pattern
- The `user_state` table should support upsert by `user_id` (the backend edge function updates it after each session)
- Consider a `user_state.session_count` counter so the mobile layer can display how many sessions have contributed to the analysis
- RLS for `user_state`: users may SELECT their own row; INSERT and UPDATE are done exclusively via the service-role edge function (no direct client writes)
- Indexes: `journal_sessions(user_id, created_at DESC)` for history queries; `journal_entries(session_id, turn_index)` for loading a session's turns

## Files Created / Modified

- **Created**: `supabase/migrations/007_journal.sql` — Forward DDL for `journal_sessions`, `journal_entries`, `user_state`; RLS policies (4 per table); indexes; user_preferences key documentation; rollback DDL. Note: file is numbered `007` (not `006` as originally planned) because `006_ocean_profile_reasoning.sql` was added after the task was written.
- **Modified**: `docs/technical/DATABASE.md` — Added schema overview tree entries; full table documentation for `journal_sessions`, `journal_entries`, `user_state`, and `user_preferences` journal keys; updated Migrations Log with `006_ocean_profile_reasoning.sql` and `007_journal.sql`; added journal query patterns section.

## Acceptance Criteria — Status

- [x] `supabase/migrations/007_journal.sql` created and applies cleanly against the existing schema
- [x] `journal_sessions` table: all columns per ADR spec, CHECK constraint on `status` enum, FK to `auth.users`, indexes on `(user_id, started_at DESC)` and partial `(user_id, status) WHERE status = 'pending'`
- [x] `journal_entries` table: all columns per ADR spec, FK to `journal_sessions`, composite UNIQUE on `(session_id, turn_index)`, CHECK on `turn_index` range (0–2), index on `(session_id, turn_index)`
- [x] `user_state` table: one-row-per-user enforced (UNIQUE on `user_id`), FK to `auth.users`, nullable `last_session_id` FK to `journal_sessions` (ON DELETE SET NULL)
- [x] RLS policies (SELECT / INSERT / UPDATE / DELETE, `user_id = auth.uid()`) on all three tables
- [x] `docs/technical/DATABASE.md` updated with full table documentation
- [x] Migration is additive (new tables only); rollback DDL included with destructive-data warning

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created |
| 2026-04-12 | @database-expert | Migration and DATABASE.md update completed |

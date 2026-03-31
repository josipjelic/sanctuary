---
id: "031"
title: "Database schema: user_lists, list_items tables + migration 005"
status: "todo"
area: "database"
agent: "@database-expert"
priority: "normal"
created_at: "2026-03-31"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: ["032", "033"]
blocked_by: ["029"]
---

## Description

Implement the database schema for the Lists feature. This includes two new tables (`user_lists`, `list_items`), an additive column on `thoughts` (`list_detection_status`), RLS policies, indexes, and migration file `supabase/migrations/005_lists.sql`. Update `docs/technical/DATABASE.md` with the new tables.

Schema guidelines come from the architecture task (#029). Do not start until #029 is complete.

## Acceptance Criteria

- [ ] `supabase/migrations/005_lists.sql` created and applies cleanly via `supabase db reset`
- [ ] `user_lists` table: `id` (uuid PK), `user_id` (uuid FK → auth.users ON DELETE CASCADE), `thought_id` (uuid FK → thoughts.id ON DELETE SET NULL — the originating thought), `title` (text NOT NULL), `normalized_title` (text NOT NULL), `status` (text NOT NULL DEFAULT `'active'`, CHECK `IN ('active', 'done')`), `detection_status` (text NOT NULL DEFAULT `'none'`, CHECK `IN ('none', 'pending', 'complete', 'failed')`), `created_at` (timestamptz DEFAULT now()), `updated_at` (timestamptz DEFAULT now())
- [ ] `list_items` table: `id` (uuid PK), `list_id` (uuid FK → user_lists.id ON DELETE CASCADE), `user_id` (uuid FK → auth.users.id ON DELETE CASCADE), `text` (text NOT NULL), `done` (boolean NOT NULL DEFAULT false), `position` (integer NOT NULL DEFAULT 0), `created_at` (timestamptz DEFAULT now()), `updated_at` (timestamptz DEFAULT now())
- [ ] `thoughts.list_detection_status` column added: text NOT NULL DEFAULT `'none'`, CHECK `IN ('none', 'pending', 'complete', 'failed')`
- [ ] UNIQUE constraint on `user_lists (user_id, normalized_title)` to support continuation matching
- [ ] RLS policies on both new tables: SELECT / INSERT / UPDATE / DELETE where `user_id = auth.uid()`
- [ ] Indexes: `idx_user_lists_user_id`, `idx_user_lists_user_normalized_title (user_id, normalized_title)`, `idx_list_items_list_id`, `idx_list_items_user_id`
- [ ] `docs/technical/DATABASE.md` updated with both new tables (columns, constraints, indexes, RLS, relationships)
- [ ] Migration is reversible — rollback DDL included as a comment in the migration file

## Technical Notes

- Follow the exact same RLS pattern as `reminders` and `user_preferences` (migration `004_reminders.sql`).
- `normalized_title` should be stored lowercase and trimmed, matching the `normalized_name` pattern in `user_topics`. The edge function will normalize before insert/lookup.
- `list_items.position` enables ordered display without relying on `created_at`; AI extracts items in order and assigns sequential position values (0-indexed).
- `user_lists.thought_id` uses ON DELETE SET NULL (not CASCADE) so a list survives if the originating thought is deleted.
- `user_lists.status` is set by the mobile client when all `list_items.done = true` — there is no server-side trigger in v1. The edge function does not set this; only the client does when marking items complete.
- The UNIQUE constraint on `(user_id, normalized_title)` is essential for the continuation detection path: the backend uses it to find the existing list to append items to.
- Include the `updated_at` trigger pattern consistent with other tables if Supabase auto-update triggers are already in use in the project; otherwise the client sends `updated_at: new Date().toISOString()` on update (check existing migrations for the pattern used).

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-31 | human | Task created |

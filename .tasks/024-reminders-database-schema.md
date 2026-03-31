---
id: "024"
title: "Database schema: reminders + user_preferences tables + migration"
status: "completed"
area: "database"
agent: "@database-expert"
priority: "high"
created_at: "2026-03-30"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: []
blocks: ["025"]
blocked_by: ["022"]
---

## Description

Design and implement the database schema for the reminders subsystem and user notification preferences. Produce a new Supabase migration file, RLS policies, and update `docs/technical/DATABASE.md`.

Tables to create:

**`reminders`**
- `id` uuid PK DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL FK → auth.users ON DELETE CASCADE
- `thought_id` uuid NOT NULL FK → thoughts ON DELETE CASCADE
- `extracted_text` text NOT NULL — the AI-extracted time-reference snippet
- `scheduled_at` timestamptz NOT NULL — the resolved future datetime for the reminder
- `lead_time` integer NULL — minutes before `scheduled_at` to fire the notification (NULL = use user_preferences default)
- `status` text NOT NULL DEFAULT 'inactive' — one of: `inactive` (awaiting approval), `active` (approved, scheduled), `dismissed` (user dismissed), `sent` (notification delivered)
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

**`user_preferences`**
- `id` uuid PK DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL FK → auth.users ON DELETE CASCADE
- `key` text NOT NULL — preference identifier (e.g. `reminder_lead_time_minutes`, `reminder_morning_time`)
- `value` jsonb NOT NULL — flexible value storage
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()
- UNIQUE constraint on `(user_id, key)`

RLS policies for both tables follow the standard pattern: SELECT/INSERT/UPDATE/DELETE all scoped to `user_id = auth.uid()`.

## Acceptance Criteria

- [ ] Migration file created under `supabase/migrations/` with a dated filename (e.g. `004_reminders_user_preferences.sql`).
- [ ] `reminders` table created with all columns, constraints, FK references, and a CHECK constraint on `status` values.
- [ ] `user_preferences` table created with UNIQUE `(user_id, key)` constraint.
- [ ] RLS enabled on both tables with SELECT / INSERT / UPDATE / DELETE policies scoped to `auth.uid()`.
- [ ] Indexes: `idx_reminders_user_id` on `(user_id)`, `idx_reminders_thought_id` on `(thought_id)`, `idx_reminders_status` on `(user_id, status)`, `idx_user_preferences_user_id` on `(user_id)`.
- [ ] `docs/technical/DATABASE.md` updated with new tables, columns, RLS, and migration log entry.
- [ ] Migration is reversible (document rollback path in DATABASE.md).

## Technical Notes

- The exact shape of `scheduled_at` and `lead_time` depends on the scheduling strategy chosen in #022. If #022 selects client-side local notifications, `scheduled_at` is still stored (it is the resolved notification fire time) — the column is valid either way.
- `status` CHECK constraint: `status IN ('inactive', 'active', 'dismissed', 'sent')`.
- `user_preferences` uses jsonb `value` to avoid adding columns for each preference type. Common keys anticipated: `reminder_lead_time_minutes` (integer), `reminder_morning_digest_time` (time string HH:MM).

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-30 | human | Task created |
| 2026-03-30 | @database-expert | Created migration 004_reminders.sql; updated DATABASE.md with reminders, user_preferences, reminder_detection_status column, migration log entry, and query patterns |

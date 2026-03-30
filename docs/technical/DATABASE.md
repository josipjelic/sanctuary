<!--
DOCUMENT METADATA
Owner: @database-expert
Update trigger: Any schema change, migration, index addition, or significant query pattern decision
Update scope: Full document
Read by: All agents. Always read before writing queries or designing schema changes.
-->

# Database Reference

> **Engine**: PostgreSQL 15 (managed by Supabase)
> **Access layer**: `@supabase/supabase-js` client (direct table queries with RLS)
> **Connection**: Via `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (client) and service role key (edge functions only)
> **Last updated**: 2026-03-30 (migration `004_reminders`)

---

## Hosted project & migrations

After [Supabase CLI](https://supabase.com/docs/guides/cli) login and `supabase link --project-ref <ref>`, apply the SQL in `supabase/migrations/` to the linked remote database:

```bash
pnpm run db:push
```

This runs `supabase db push` and records migration history on the host. New schema work: add a dated file under `supabase/migrations/`, then run `db:push` again (or use `supabase db pull` / local diff workflows per Supabase docs when iterating from the dashboard).

---

## Schema Overview

All user data is isolated via Row Level Security (RLS). Every table that stores user data has a `user_id` column referencing `auth.users.id` (directly or via FK to `thoughts`). RLS policies enforce access per user.

```
auth.users (managed by Supabase Auth)
  |
  +--< user_topics
  |
  +--< thoughts
  |      |
  |      +--< thought_topics >-- user_topics
  |      |
  |      +--< reminders
  |
  +--< daily_checkins
  |
  +--< user_preferences
```

**Key relationships**:
- `auth.users` → `thoughts`: one user, many thoughts
- `auth.users` → `user_topics`: one user, many topic labels (catalog)
- `thoughts` ↔ `user_topics`: many-to-many via `thought_topics` (v1 assigns **one** primary topic per thought; legacy rows may have multiple links from backfill)
- `thoughts.topics` (`text[]`): denormalized display names, kept in sync when AI assigns a topic (typically a one-element array)
- `auth.users` → `reminders`: one user, many reminders; each reminder links back to the originating thought
- `auth.users` → `user_preferences`: key-value store for per-user notification and app preferences

---

## Tables

> Authoritative DDL: `supabase/migrations/`.

---

### thoughts

**Purpose**: Core table. Stores all captured thoughts — text entries, voice transcripts, journal expansions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL, FK -> auth.users.id ON DELETE CASCADE | Owner |
| body | text | NOT NULL | The thought text (typed or transcribed) |
| body_extended | text | NULL | Expanded journal entry (set by user in detail view) |
| topics | text[] | NOT NULL, DEFAULT '{}' | Denormalized topic **names** for the thought (synced from `thought_topics`) |
| has_audio | boolean | NOT NULL, DEFAULT false | Whether this thought originated from a voice recording (audio stored locally on device only) |
| transcription_status | text | NOT NULL, DEFAULT 'none' | 'none', 'pending', 'complete', 'failed' |
| tagging_status | text | NOT NULL, DEFAULT 'none' | Topic-assignment lifecycle: 'none', 'pending', 'complete', 'failed' |
| reminder_detection_status | text | NOT NULL, DEFAULT 'none' | Reminder-detection pipeline lifecycle: 'none', 'pending', 'complete', 'failed' |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Capture time |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last edit time |

**Indexes**:
- `idx_thoughts_user_id` on `(user_id)`
- `idx_thoughts_created_at` on `(user_id, created_at DESC)`
- GIN `idx_thoughts_topics` on `topics` — containment filters (`@>`)

**RLS policies**: SELECT / INSERT / UPDATE / DELETE where `user_id = auth.uid()`.

---

### user_topics

**Purpose**: Per-user topic catalog. AI prefers reusing these when the model-reported match score is above the configured threshold (see ADR-002); otherwise a new row is created.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| user_id | uuid | NOT NULL, FK -> auth.users ON DELETE CASCADE | Owner |
| name | text | NOT NULL | Display label (typically normalized lowercase) |
| normalized_name | text | NOT NULL, UNIQUE per user | Lowercase, trimmed, for matching |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

**Constraints**: `UNIQUE (user_id, normalized_name)`

**Indexes**: `idx_user_topics_user_id` on `(user_id)`

**RLS policies**: CRUD where `user_id = auth.uid()`.

---

### thought_topics

**Purpose**: Links a thought to one or more `user_topics` rows (junction).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| thought_id | uuid | PK (composite), FK -> thoughts ON DELETE CASCADE | |
| topic_id | uuid | PK (composite), FK -> user_topics ON DELETE CASCADE | |

**Indexes**: `thought_id`, `topic_id`

**RLS policies**: SELECT / INSERT / DELETE allowed when the thought is owned by `auth.uid()` (EXISTS join to `thoughts`).

---

### daily_checkins

**Purpose**: Daily mood and intention check-ins. One row per user per calendar day.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL, FK -> auth.users.id ON DELETE CASCADE | Owner |
| check_in_date | date | NOT NULL | The calendar day for this check-in |
| mood | text | NULL | User's mood/emotional state (free text or enum — TBD) |
| intention | text | NULL | User's daily intention or theme |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

**Constraints**:
- UNIQUE `(user_id, check_in_date)` — enforces one check-in per day per user

**Indexes**:
- `idx_daily_checkins_user_date` on `(user_id, check_in_date DESC)` — history queries

**RLS policies**:
- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

---

### reminders

**Purpose**: Stores AI-detected time references extracted from thoughts. Each row represents a single reminder awaiting user approval or already scheduled as a local notification. A thought may produce zero or more reminders.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL, FK -> auth.users.id ON DELETE CASCADE | Owner |
| thought_id | uuid | NOT NULL, FK -> thoughts.id ON DELETE CASCADE | The thought this reminder was extracted from |
| extracted_text | text | NOT NULL | Raw text snippet the AI identified as a time reference |
| scheduled_at | timestamptz | NOT NULL | Resolved future datetime for the notification fire time |
| lead_time | integer | NULL | Minutes before `scheduled_at` to fire (NULL = use `user_preferences` default) |
| status | text | NOT NULL, DEFAULT 'inactive' | Lifecycle: 'inactive' (awaiting approval), 'active' (approved, scheduled), 'dismissed', 'sent' |
| notification_id | text | NULL | Expo local notification ID returned by `scheduleNotificationAsync`; set when status → 'active'; used to cancel or reschedule |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

**Constraints**:
- CHECK `reminders_status_check`: `status IN ('inactive', 'active', 'dismissed', 'sent')`

**Indexes**:
- `idx_reminders_user_id` on `(user_id)` — existence checks and full user-scoped queries
- `idx_reminders_thought_id` on `(thought_id)` — fetch all reminders for a given thought
- `idx_reminders_user_status` on `(user_id, status)` — primary query pattern: all reminders in a given status for a user (e.g. all 'inactive' awaiting approval)

**Relationships**:
- `user_id` → `auth.users.id` (ON DELETE CASCADE)
- `thought_id` → `thoughts.id` (ON DELETE CASCADE)

**RLS policies**: SELECT / INSERT / UPDATE / DELETE where `user_id = auth.uid()`.

**Notes**: `notification_id` is NULL until the user approves a reminder and the mobile client calls `scheduleNotificationAsync`. Scheduling is client-side in v1 (ADR-004) — no server-side scheduler state machine is required; `scheduled_at` is the resolved fire time stored for audit and reschedule purposes.

---

### user_preferences

**Purpose**: Per-user key-value store for notification and app preferences. JSONB `value` avoids adding a column for each new preference type. Anticipated keys in v1: `reminder_lead_time_minutes` (integer — minutes before `scheduled_at` to notify) and `reminder_morning_digest_time` (string HH:MM — morning digest window time).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL, FK -> auth.users.id ON DELETE CASCADE | Owner |
| key | text | NOT NULL | Preference identifier, e.g. `reminder_lead_time_minutes` |
| value | jsonb | NOT NULL | Preference value; type depends on key (e.g. integer `30`, string `"07:30"`) |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

**Constraints**:
- UNIQUE `user_preferences_user_key_unique`: `(user_id, key)` — one value per preference key per user

**Indexes**:
- `idx_user_preferences_user_id` on `(user_id)` — load all preferences for a user in one query

**Relationships**:
- `user_id` → `auth.users.id` (ON DELETE CASCADE)

**RLS policies**: SELECT / INSERT / UPDATE / DELETE where `user_id = auth.uid()`.

**Notes**: Application code should upsert using `ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`. JSONB is appropriate here because preference values are heterogeneous scalars (integers, time strings, booleans) and the key set grows without schema changes. This is not an EAV anti-pattern — the value types are small, known scalars, not nested entities, and there is no requirement to query across key names in a relational join.

---

## Migrations Log

| Migration File | Date | Description | Reversible | Deployment Risk |
|----------------|------|-------------|------------|-----------------|
| `001_create_thoughts.sql` | 2026-03-28 | Create thoughts table with RLS | Yes | None |
| `002_create_daily_checkins.sql` | 2026-03-28 | Create daily_checkins table with RLS | Yes | None |
| `003_user_topics_rename_tags.sql` | 2026-03-28 | user_topics, thought_topics, rename `tags` → `topics`, backfill | Yes | Low — additive + column rename |
| `004_reminders.sql` | 2026-03-30 | Create reminders and user_preferences tables; add reminder_detection_status to thoughts | Yes — see rollback DDL in migration file | Low — two new tables + additive column on thoughts (no lock on large tables) |

---

## Query Patterns

### Common Patterns

**Fetch user's inbox (newest first)**:
```sql
SELECT id, body, topics, transcription_status, tagging_status, created_at
FROM thoughts
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 50;
```

**Filter by topic name (denormalized array)**:
```sql
SELECT id, body, topics, created_at
FROM thoughts
WHERE user_id = auth.uid()
  AND topics @> ARRAY['grocery']
ORDER BY created_at DESC;
```

**List a user's topic catalog**:
```sql
SELECT id, name, normalized_name, created_at
FROM user_topics
WHERE user_id = auth.uid()
ORDER BY normalized_name;
```

**Full-text search**:
```sql
SELECT id, body, topics, created_at
FROM thoughts
WHERE user_id = auth.uid()
  AND body ILIKE '%' || $1 || '%'
ORDER BY created_at DESC;
```

**Get today's check-in (upsert on capture)**:
```sql
SELECT * FROM daily_checkins
WHERE user_id = auth.uid()
  AND check_in_date = CURRENT_DATE;
```

**Fetch all inactive reminders for a user (awaiting approval)**:
```sql
SELECT id, thought_id, extracted_text, scheduled_at, lead_time, created_at
FROM reminders
WHERE user_id = auth.uid()
  AND status = 'inactive'
ORDER BY scheduled_at ASC;
```

**Upsert a user preference**:
```sql
INSERT INTO user_preferences (user_id, key, value)
VALUES (auth.uid(), 'reminder_lead_time_minutes', '30'::jsonb)
ON CONFLICT ON CONSTRAINT user_preferences_user_key_unique
DO UPDATE SET value = EXCLUDED.value, updated_at = now();
```

**Fetch all preferences for a user**:
```sql
SELECT key, value
FROM user_preferences
WHERE user_id = auth.uid();
```

---

## Known Issues & Tech Debt

| Issue | Impact | Plan |
|-------|--------|------|
| No full-text search index | `ILIKE` searches will be slow at scale | Add `tsvector` column and GIN index in v2 |
| Model-reported match scores | Topic reuse threshold depends on LLM calibration | Tune prompts; optional analytics on score distribution |

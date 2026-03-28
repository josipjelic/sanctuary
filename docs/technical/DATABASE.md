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
> **Last updated**: 2026-03-28 (migration `003_user_topics_rename_tags`)

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
  |
  +--< daily_checkins
```

**Key relationships**:
- `auth.users` → `thoughts`: one user, many thoughts
- `auth.users` → `user_topics`: one user, many topic labels (catalog)
- `thoughts` ↔ `user_topics`: many-to-many via `thought_topics` (v1 assigns **one** primary topic per thought; legacy rows may have multiple links from backfill)
- `thoughts.topics` (`text[]`): denormalized display names, kept in sync when AI assigns a topic (typically a one-element array)

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

## Migrations Log

| Migration File | Date | Description | Reversible | Deployment Risk |
|----------------|------|-------------|------------|-----------------|
| `001_create_thoughts.sql` | 2026-03-28 | Create thoughts table with RLS | Yes | None |
| `002_create_daily_checkins.sql` | 2026-03-28 | Create daily_checkins table with RLS | Yes | None |
| `003_user_topics_rename_tags.sql` | 2026-03-28 | user_topics, thought_topics, rename `tags` → `topics`, backfill | Yes | Low — additive + column rename |

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

---

## Known Issues & Tech Debt

| Issue | Impact | Plan |
|-------|--------|------|
| No full-text search index | `ILIKE` searches will be slow at scale | Add `tsvector` column and GIN index in v2 |
| Model-reported match scores | Topic reuse threshold depends on LLM calibration | Tune prompts; optional analytics on score distribution |

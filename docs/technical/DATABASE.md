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
> **Last updated**: 2026-03-28

---

## Schema Overview

All user data is isolated via Row Level Security (RLS). Every table that stores user data has a `user_id` column referencing `auth.users.id`. RLS policies enforce `user_id = auth.uid()` for all reads and writes.

```
auth.users (managed by Supabase Auth)
  |
  +--< thoughts
  |      |
  |      +-- tags (array column on thoughts)
  |
  +--< daily_checkins
```

**Key relationships**:
- `auth.users` -> `thoughts`: one user can have many thoughts
- `auth.users` -> `daily_checkins`: one user can have many check-ins (one per calendar day)
- Tags are stored as a `text[]` array on the `thoughts` table (no separate tags table needed for v1)

---

## Tables

> Full schema to be designed by @database-expert in task #001. This file documents the agreed schema after that task is complete.

---

### thoughts

**Purpose**: Core table. Stores all captured thoughts — text entries, voice transcripts, journal expansions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL, FK -> auth.users.id ON DELETE CASCADE | Owner |
| body | text | NOT NULL | The thought text (typed or transcribed) |
| body_extended | text | NULL | Expanded journal entry (set by user in detail view) |
| tags | text[] | NOT NULL, DEFAULT '{}' | AI-assigned and/or manually edited tags |
| has_audio | boolean | NOT NULL, DEFAULT false | Whether this thought originated from a voice recording (audio stored locally on device only) |
| transcription_status | text | NOT NULL, DEFAULT 'none' | 'none', 'pending', 'complete', 'failed' |
| tagging_status | text | NOT NULL, DEFAULT 'none' | 'none', 'pending', 'complete', 'failed' |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Capture time |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last edit time |

**Indexes**:
- `idx_thoughts_user_id` on `(user_id)` — inbox queries filter by user
- `idx_thoughts_created_at` on `(user_id, created_at DESC)` — chronological inbox sort
- GIN index on `tags` — tag filter queries

**RLS policies**:
- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

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
| `001_create_thoughts.sql` | [TBD] | Create thoughts table with RLS | Yes | None |
| `002_create_daily_checkins.sql` | [TBD] | Create daily_checkins table with RLS | Yes | None |

---

## Query Patterns

### Common Patterns

**Fetch user's inbox (newest first)**:
```sql
SELECT id, body, tags, transcription_status, tagging_status, created_at
FROM thoughts
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 50;
```

**Filter by tag**:
```sql
SELECT id, body, tags, created_at
FROM thoughts
WHERE user_id = auth.uid()
  AND tags @> ARRAY['grocery']
ORDER BY created_at DESC;
```

**Full-text search**:
```sql
SELECT id, body, tags, created_at
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
| Tags stored as text[] | No tag normalization (duplicates like "grocery" vs "groceries") | Consider a tags lookup table in v2 |
| No full-text search index | `ILIKE` searches will be slow at scale | Add `tsvector` column and GIN index in v2 |

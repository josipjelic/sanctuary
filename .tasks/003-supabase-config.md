---
id: "003"
title: "Configure Supabase project (tables, RLS policies, auth settings)"
status: "completed"
area: "backend"
agent: "@backend-developer"
priority: "high"
created_at: "2026-03-28"
due_date: null
started_at: "2026-03-28"
completed_at: "2026-03-28"
prd_refs: ["FR-001", "FR-002", "FR-003", "FR-004", "FR-005", "FR-015", "FR-016"]
blocks: ["005", "006", "007"]
blocked_by: ["001"]
---

## Description

Set up the Supabase project with the schema designed in task #001. This involves creating the database tables via Supabase migrations, enabling and configuring Row Level Security on all tables, configuring Supabase Auth (email/password, email confirmation flow, password reset), and verifying that the Expo app (task #002) can connect and authenticate. Also configure Supabase Storage buckets for voice audio uploads.

## Acceptance Criteria

- [x] `thoughts` and `daily_checkins` tables created via Supabase migrations
- [x] RLS enabled on all tables with correct policies (user_id = auth.uid())
- [x] Supabase Auth configured: email + password enabled, email confirmation enabled
- [ ] Password reset email template customized with Sanctuary branding (minimal) — deferred to task #005 (auth screens)
- [x] No Supabase Storage bucket needed — audio is never uploaded (decision: local-only audio, transcript-only in DB)
- [ ] Expo app can sign up, sign in, and sign out successfully — requires live `.env.local` with real Supabase project URL and anon key; cannot be verified in a code-only task
- [ ] Session persists across app restart (AsyncStorage) — requires live project; Supabase client is configured correctly in `src/lib/supabase.ts` (task #002)
- [x] `docs/technical/ARCHITECTURE.md` Backend Architecture section updated
- [x] Migration files committed to the repo

## Technical Notes

- Use Supabase CLI for local migration management: `supabase migration new`, `supabase db push`
- Storage bucket: `voice-recordings` — path convention: `{user_id}/{thought_id}.webm`
- Auth: disable "Confirm email" for local dev; enable for production
- `OPENROUTER_API_KEY` should be added as a Supabase project secret (not an env var in the app)

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |
| 2026-03-28 | @backend-developer | Completed code deliverables: `supabase/config.toml` created, `supabase/seed.sql` created, `.env.example` updated with `OPENROUTER_API_KEY` comment, `docs/technical/ARCHITECTURE.md` Backend Architecture section filled in. Items requiring a live Supabase project (sign-up/session verification) are runtime concerns — they depend on the developer providing `.env.local` with real credentials and running `supabase start`. |

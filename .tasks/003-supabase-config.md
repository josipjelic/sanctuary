---
id: "003"
title: "Configure Supabase project (tables, RLS policies, auth settings)"
status: "todo"
area: "backend"
agent: "@backend-developer"
priority: "high"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-001", "FR-002", "FR-003", "FR-004", "FR-005", "FR-015", "FR-016"]
blocks: ["005", "006", "007"]
blocked_by: ["001"]
---

## Description

Set up the Supabase project with the schema designed in task #001. This involves creating the database tables via Supabase migrations, enabling and configuring Row Level Security on all tables, configuring Supabase Auth (email/password, email confirmation flow, password reset), and verifying that the Expo app (task #002) can connect and authenticate. Also configure Supabase Storage buckets for voice audio uploads.

## Acceptance Criteria

- [ ] `thoughts` and `daily_checkins` tables created via Supabase migrations
- [ ] RLS enabled on all tables with correct policies (user_id = auth.uid())
- [ ] Supabase Auth configured: email + password enabled, email confirmation enabled
- [ ] Password reset email template customized with Sanctuary branding (minimal)
- [ ] No Supabase Storage bucket needed — audio is never uploaded (decision: local-only audio, transcript-only in DB)
- [ ] Expo app can sign up, sign in, and sign out successfully
- [ ] Session persists across app restart (AsyncStorage)
- [ ] `docs/technical/ARCHITECTURE.md` Backend Architecture section updated
- [ ] Migration files committed to the repo

## Technical Notes

- Use Supabase CLI for local migration management: `supabase migration new`, `supabase db push`
- Storage bucket: `voice-recordings` — path convention: `{user_id}/{thought_id}.webm`
- Auth: disable "Confirm email" for local dev; enable for production
- `OPENROUTER_API_KEY` should be added as a Supabase project secret (not an env var in the app)

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |

---
id: "046"
title: "AI-guided journal: backend edge functions"
status: "done"
area: "backend"
agent: "@backend-developer"
priority: "normal"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-12"
completed_at: "2026-04-12"
prd_refs: ["FR-030", "FR-060", "FR-061", "FR-062", "FR-063"]
blocks: ["047"]
blocked_by: ["045"]
---

## Description

Implement the two Supabase edge functions that power the AI-Guided Journal feature. Both functions follow the existing edge function conventions (TypeScript, Deno, `verify_jwt = false` + internal `getUser()`, ADR-003 structured logging).

### `journal-next-question`

Receives the current session context and returns the next question (or a completion signal).

**Input**: session ID, all prior Q&A turns in the session, the user's current `user_state` text snapshot.
**Logic**:
1. Validate the session belongs to the authenticated user and is `active`.
2. Enforce max-3-turns server-side: if 3 questions have already been asked, return `{ done: true }`.
3. If turn 0 (no prior turns): return the fixed opening question (hardcoded or configured).
4. Otherwise: call OpenRouter with the prior turns + user state snapshot. AI selects the most relevant follow-up question considering the user's answers and any unresolved problems/struggles from the user state. AI must not make assumptions about the user's life situation.
5. Return `{ question: string, done: false }` or `{ done: true }`.
6. Log the AI request and response per ADR-003 (omit user state raw text from logs beyond a truncated fingerprint).

### `journal-save-session`

Saves a completed or abandoned session and triggers a fire-and-forget user state update.

**Input**: session ID, all Q&A turns, final status (`completed` | `abandoned`).
**Logic**:
1. Validate ownership and that the session is `active`.
2. Upsert all `journal_entries` rows for the session.
3. Update `journal_sessions.status` and `completed_at`.
4. Fire-and-forget: call an internal helper that reads the user's last N sessions (e.g. last 10 completed) and calls OpenRouter to regenerate the 200-word `user_state` analysis. Store result via upsert on `user_state`. This must not block the save response (`.catch(() => {})` pattern).
5. Log per ADR-003.

Also update `docs/technical/API.md` to document both endpoints.

## Acceptance Criteria

- [x] `supabase/functions/journal-next-question/index.ts` implemented and deployed
- [x] `supabase/functions/journal-save-session/index.ts` implemented and deployed
- [x] Max-3-turns enforcement is server-side in `journal-next-question`
- [x] Fixed opening question is returned on turn 0 (no AI call needed)
- [x] User state update in `journal-save-session` is fire-and-forget (never blocks the response)
- [x] Both functions validate JWT via `getUser()` and reject unauthorised requests with 401
- [x] Both functions instrument all AI calls with ADR-003 structured logging (no raw user state text in logs)
- [x] `docs/technical/API.md` updated with both endpoint specifications
- [x] Error handling: malformed input → 400; session not found or wrong user → 403; upstream AI failure → 502 with graceful message

## Technical Notes

- Read the architecture ADR (task #043) and database schema (task #045) before starting — the ADR specifies the exact JSON contracts
- Mirror `detect-reminders` for edge function scaffolding (JWT pattern, logging, error shape)
- Mirror `assign-topics` for OpenRouter call patterns (shared `callOpenRouter` helper if it exists)
- The opening question is: "What's been on your mind lately?" (or per the architecture ADR if a different question is specified there). Make it a named constant.
- The user state regeneration prompt must instruct the AI to write a 200-word summary in third person, focusing on recurring themes, unresolved challenges, and emotional patterns — never biographical facts the user hasn't volunteered.
- `journal-next-question` must pass `user_state.analysis` to the AI as a system prompt preamble, not as a user message, to keep conversation flow natural.
- Both functions must be listed in `supabase/config.toml` with `verify_jwt = false`.

## Files Created / Modified

| File | Change |
|------|--------|
| `supabase/functions/journal-next-question/index.ts` | Created — journal-next-question edge function |
| `supabase/functions/journal-save-session/index.ts` | Created — journal-save-session edge function |
| `supabase/functions/_shared/ai-log.ts` | Added `"journal_question"` and `"journal_state_update"` to `AiLogPhase` union |
| `supabase/config.toml` | Added `[functions.journal-next-question]` and `[functions.journal-save-session]` entries with `verify_jwt = false` |
| `docs/technical/API.md` | Added `## Journal` section with full specs for both endpoints; updated observability docs |

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created |
| 2026-04-12 | @backend-developer | Implemented journal-next-question and journal-save-session edge functions; updated ai-log.ts phases, config.toml, and API.md |

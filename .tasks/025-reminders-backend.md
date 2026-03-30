---
id: "025"
title: "Backend: detect-reminders edge function + pipeline wiring"
status: "completed"
area: "backend"
agent: "@backend-developer"
priority: "high"
created_at: "2026-03-30"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: []
blocks: ["026"]
blocked_by: ["024"]
---

## Description

Implement the backend for the reminders subsystem:

1. **`detect-reminders` edge function** — receives `thought_id` + `text`, calls OpenRouter to extract future time references, and inserts `inactive` reminder rows into the `reminders` table. Returns extracted reminders (or an empty array when none are found). Must be non-blocking relative to the thought capture confirmation — the mobile client should not wait for this call to show a "captured" state.

2. **Pipeline wiring** — wire `detect-reminders` into both the `transcribe` pipeline (call after topic assignment completes, fire-and-forget or background) and the `assign-topics` path (same pattern for typed capture).

3. **CRUD endpoints** — within the same or a companion edge function, expose:
   - Approve a reminder: update `status` from `inactive` → `active`, optionally update `scheduled_at` if the user edited it.
   - Dismiss a reminder: update `status` → `dismissed`.
   - List pending reminders: fetch all `inactive` reminders for the authenticated user (across all thoughts).

4. **`docs/technical/API.md` update** — document the new edge function(s), request/response shapes, and error codes.

## Acceptance Criteria

- [x] `supabase/functions/detect-reminders/index.ts` created and deployable.
- [x] AI extraction prompt instructs the model to return structured JSON: array of `{ extracted_text, scheduled_at }` (empty array when none found).
- [x] Inserts `inactive` reminder rows into `reminders` table; handles empty result (no inserts, no error).
- [x] Pipeline wiring in `transcribe` and `assign-topics` (or shared module): reminder detection fires after topic assignment, non-blocking (failure must not fail the parent capture).
- [x] Approve/dismiss/list: implemented as direct Supabase table access (RLS-scoped); documented in API.md under "Direct table access patterns (Reminders)".
- [x] `supabase/config.toml` updated with `[functions.detect-reminders] verify_jwt = false` (OPTIONS preflight) per existing pattern.
- [x] Structured AI logs emitted per ADR-003 contract (`ai.request.start`, `ai.response.complete`, `ai.error` via `console.debug`).
- [x] `docs/technical/API.md` updated with new endpoint(s).
- [x] Existing 70 unit tests pass; new shared module follows testable pure-function pattern.
- [x] Relevant documentation updated.

## Technical Notes

- Shared module pattern: consider `supabase/functions/_shared/detect-reminders.ts` mirroring `_shared/assign-topics.ts` so both pipelines import the same extraction logic.
- The AI prompt for time extraction should handle relative references ("tomorrow", "next Tuesday", "in 3 hours") relative to a `now` timestamp that the client must pass in the request body (do not rely on server clock alone — the thought may have been captured offline and synced later).
- Non-blocking wiring: in `transcribe` and `assign-topics`, call `detect-reminders` with `EdgeRuntime.waitUntil()` or equivalent fire-and-forget pattern so it does not extend the response time visible to the user.
- Model: use `OPENROUTER_TOPIC_MODEL` or a dedicated `OPENROUTER_REMINDER_MODEL` env var; default to `google/gemini-2.0-flash-001`.
- Follow ADR-003 for logging: no raw thought text in `request_summary` beyond a short preview; no secrets.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-30 | human | Task created |
| 2026-03-30 | @backend-developer | Implemented: shared `_shared/detect-reminders.ts`, standalone `detect-reminders/index.ts` edge function, pipeline wiring in `transcribe` and `assign-topics` (fire-and-forget), `config.toml` updated, `API.md` updated with endpoint docs and direct table access patterns. All 70 tests pass, Biome lint clean. |

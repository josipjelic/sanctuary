---
id: "032"
title: "Backend: detect-list edge function + pipeline wiring"
status: "todo"
area: "backend"
agent: "@backend-developer"
priority: "normal"
created_at: "2026-03-31"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: ["034"]
blocked_by: ["031"]
---

## Description

Implement the server-side list detection pipeline. This includes a shared Deno module `supabase/functions/_shared/detect-list.ts`, a standalone `detect-list` edge function, and fire-and-forget wiring into the existing `transcribe` and `assign-topics` edge functions. Update `docs/technical/API.md` with the new endpoint.

The shared module is the core: it calls OpenRouter to determine whether a thought is a list, extracts the title and items if so, and detects whether it continues an existing user list by comparing the extracted title against `user_lists.normalized_title`.

Do not start until the database schema task (#031) is complete.

## Acceptance Criteria

- [ ] `supabase/functions/_shared/detect-list.ts` implemented: calls OpenRouter, receives structured JSON (`{ is_list, title, items: [{ text, position }], continuation_of_list_id? }`), inserts `user_lists` row (or appends items to existing if continuation), inserts `list_items` rows, updates `thoughts.list_detection_status`
- [ ] Continuation detection: module loads caller's `user_lists` (id + normalized_title), passes them to the model, model returns `continuation_of_list_id` when it matches an existing list; server falls back to normalized string comparison if model omits the field
- [ ] `supabase/functions/detect-list/index.ts` standalone edge function: accepts `{ thought_id, text, iana_timezone?, current_local_iso? }`, returns `{ thought_id, is_list, list_id? }`, follows the same auth pattern (`verify_jwt = false` in config.toml, `getUser()` inside)
- [ ] Fire-and-forget wiring in `supabase/functions/transcribe/index.ts`: `detectList(...).catch(() => {})` after `detectReminders` fire-and-forget (pipeline order: topics → reminders → lists)
- [ ] Fire-and-forget wiring in `supabase/functions/assign-topics/index.ts`: same pattern
- [ ] `thoughts.list_detection_status` set to `'pending'` before AI call, `'complete'` on success, `'failed'` on error
- [ ] Structured logging per ADR-003: events `ai.request.start`, `ai.response.complete`, `ai.error` via `console.debug` with `phase: "list_detection"`
- [ ] `docs/technical/API.md` updated: `POST /detect-list` endpoint documented, pipeline wiring section updated, direct table access patterns for `user_lists` and `list_items` added
- [ ] Model resolution: `OPENROUTER_LIST_MODEL` → `OPENROUTER_TOPIC_MODEL` → `google/gemini-2.0-flash-001`
- [ ] Unit tests for the shared module (detection logic, continuation matching, malformed AI response handling)

## Technical Notes

- Follow `supabase/functions/_shared/detect-reminders.ts` as the structural template.
- The AI model contract (JSON shape) is defined by the architecture task (#029) ADR — implement to that spec.
- Non-blocking contract: list detection runs after reminder detection in the pipeline. Both are fire-and-forget. A failure in list detection must not affect the HTTP response.
- Continuation detection priority: if the model returns a `continuation_of_list_id` that matches a known `user_lists.id` for this user, use it directly. If the model returns a title that normalized-matches an existing `user_lists.normalized_title`, treat as continuation. Otherwise create a new `user_lists` row.
- When creating a new list on continuation (no match), position values for new items should start after the highest existing `list_items.position` for that list.
- `verify_jwt = false` in `supabase/config.toml` for `[functions.detect-list]` — add this entry alongside the existing reminders config.
- Logging must follow ADR-003 redaction rules: no raw audio, no full thought body beyond a short preview, no secrets.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-31 | human | Task created |

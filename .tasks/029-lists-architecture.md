---
id: "029"
title: "Lists detection subsystem: architecture + ADR"
status: "todo"
area: "infra"
agent: "@systems-architect"
priority: "normal"
created_at: "2026-03-31"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: ["031", "032", "033", "034"]
blocked_by: []
---

## Description

Design and document the architecture for the Lists Detection & Management subsystem. This is a new AI-powered pipeline that detects whether a captured thought is a list (grocery list, to-do list, etc.), extracts its title and items, and identifies whether it is a continuation of an existing list by matching against the user's `user_lists` catalog.

The work product is an ADR entry in `docs/technical/DECISIONS.md` and an updated section in `docs/technical/ARCHITECTURE.md` covering:

- Pipeline placement: fire-and-forget after `assign-topics` in both `transcribe` and `assign-topics` edge functions (same pattern as `detect-reminders`)
- Continuation detection approach: title matching against `user_lists.normalized_title` (threshold TBD — propose and justify)
- Schema guidelines for the database task (#031): `user_lists`, `list_items`, `thoughts.list_detection_status`
- AI model contract: expected JSON shape for detection response
- Non-blocking contract: list detection must never slow or fail the capture response
- Edge function inventory update: add `detect-list` to the table in ARCHITECTURE.md

## Acceptance Criteria

- [ ] ADR written and merged into `docs/technical/DECISIONS.md` covering pipeline placement, continuation detection approach, and schema guidelines
- [ ] `docs/technical/ARCHITECTURE.md` updated: edge function inventory includes `detect-list`, Lists subsystem section added (mirrors the Reminders Subsystem section style)
- [ ] AI model contract (request/response JSON shape) specified in the ADR or ARCHITECTURE.md
- [ ] Non-blocking fire-and-forget contract explicitly documented
- [ ] Continuation detection title-matching strategy documented with rationale
- [ ] Schema guidelines provided for @database-expert (task #031) to implement without further architectural clarification

## Technical Notes

- Mirror the approach used for reminders (ADR-004 + ARCHITECTURE.md Reminders Subsystem section) as the structural template.
- Pipeline placement must be after `assign-topics` completes (or fails), before the HTTP response is returned. Fire-and-forget via `.catch(() => {})` — same as `detectReminders`.
- Continuation detection: the AI receives the user's existing `user_lists` titles and must report whether this thought continues one of them. Title matching should be case-insensitive normalized comparison similar to topic reuse in ADR-002.
- Consider: should the AI do fuzzy title matching (e.g. "grocery" matches "groceries") or exact normalized match? The ADR should propose one approach and justify it.
- `thoughts.list_detection_status` should follow the same CHECK constraint pattern as `reminder_detection_status`: `'none' | 'pending' | 'complete' | 'failed'`.
- Voice and typed capture must both pass `iana_timezone` + `current_local_iso` to list detection if timestamps become relevant (likely not for v1, but document the option).
- The standalone `detect-list` edge function follows the same `verify_jwt = false` + internal `getUser()` pattern as `detect-reminders`.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-31 | human | Task created |

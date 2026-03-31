---
id: "035"
title: "Tests: list detection, item completion, continuation matching, RLS"
status: "todo"
area: "qa"
agent: "@qa-engineer"
priority: "normal"
created_at: "2026-03-31"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: []
blocked_by: ["034"]
---

## Description

Write and verify tests for the Lists Detection & Management subsystem. Coverage spans the shared detection module (unit), item completion state transitions (unit/integration), continuation matching logic (unit), and RLS policy enforcement on `user_lists` and `list_items` (integration).

Do not start until the mobile screens task (#034) is complete, as that is the point at which the full vertical slice is implemented and testable end-to-end.

## Acceptance Criteria

- [ ] Unit tests for `supabase/functions/_shared/detect-list.ts`: non-list response (returns `is_list: false`), list response with item extraction, continuation detection when a matching `user_lists` title exists, continuation detection when no match exists (new list created), malformed AI JSON response handled gracefully without throwing
- [ ] Unit tests for list completion logic (client-side): all items done → `user_lists.status` set to `'done'`; one item un-toggled → status reverts to `'active'`
- [ ] Unit tests for `ListItemRow.tsx`: renders item text, renders strike-through when `done = true`, fires `onToggle` with correct args on press
- [ ] Unit tests for `ListCard.tsx`: renders title, item count, completion progress, `status === 'done'` pill variant
- [ ] Integration / RLS tests: a user cannot read, insert, update, or delete `user_lists` or `list_items` rows belonging to another user
- [ ] `thoughts.list_detection_status` transitions tested: `'none'` → `'pending'` → `'complete'` and `'none'` → `'pending'` → `'failed'`
- [ ] All tests pass under `pnpm test`
- [ ] Coverage for new files meets the 80% target per CLAUDE.md conventions

## Technical Notes

- Use Jest colocated test files (`*.test.ts` / `*.test.tsx`) next to source files.
- For RLS tests, use the Supabase local stack (`supabase start`) with two test users and verify cross-user access is denied.
- Mock OpenRouter responses in unit tests for `detect-list.ts` — do not make real network calls in CI.
- The continuation matching unit tests should cover: exact normalized title match, case-insensitive match (e.g. "Grocery" matches "grocery"), no match (new list), and empty `user_lists` catalog.
- `testID` props on `ListItemRow` checkbox and `ListCard` elements make E2E selection easier when the E2E framework is added (TODO #013–#014).

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-31 | human | Task created |

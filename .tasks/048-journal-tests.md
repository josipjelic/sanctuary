---
id: "048"
title: "AI-guided journal: tests"
status: "todo"
area: "qa"
agent: "@qa-engineer"
priority: "normal"
created_at: "2026-04-11"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: []
blocked_by: ["047"]
---

## Description

Write tests for the AI-Guided Journal feature covering the session state machine, user state update logic, evening notification scheduling, max-turns enforcement, and RLS policies. Blocked by mobile implementation (#047) being complete so tests can be written against the real code.

### Test areas

1. **Session state machine** (unit tests):
   - New session starts in `pending`, transitions to `active` on first question load
   - Session transitions to `completed` when user finishes (any turn ≤ 3)
   - Session transitions to `abandoned` on start-fresh
   - Cannot transition from `completed` or `abandoned` back to `active`

2. **Max-3-questions enforcement** (unit tests for edge function logic):
   - `journal-next-question` returns `{ done: true }` when 3 questions have been asked
   - Client-side guard also prevents submitting a 4th answer
   - Server-side check is independent of client state

3. **User state update logic** (unit tests):
   - After a completed session, `user_state.analysis` is updated (mock the OpenRouter call)
   - Abandoned sessions do NOT trigger a user state update
   - User state update failure does not cause `journal-save-session` to fail (fire-and-forget)

4. **Evening notification scheduling** (unit tests / integration):
   - Toggling the reminder on schedules exactly one daily notification at the configured time
   - Changing the time cancels the old notification and schedules a new one
   - Toggling off cancels the scheduled notification
   - Denied permissions surface a user-visible message without crashing

5. **RLS policies** (integration tests against Supabase test instance):
   - User A cannot read `journal_sessions` owned by User B
   - User A cannot read `journal_entries` owned by User B
   - User A cannot read `user_state` owned by User B
   - Service role can write to `user_state` (simulates edge function update)

6. **Resume/start-fresh detection** (unit tests):
   - When an `active` session exists, the resume prompt is shown
   - When no active session exists, the journal tab goes directly to a new session start
   - Choosing "start fresh" correctly abandons the old session before creating a new one

## Acceptance Criteria

- [ ] Session state machine: all valid transitions tested; invalid transitions tested to confirm they are rejected
- [ ] Max-3-questions: server-side enforcement tested with mocked session; client-side guard tested in component
- [ ] User state update: update-on-complete tested; no-update-on-abandon tested; fire-and-forget failure isolation tested
- [ ] Notification scheduling: schedule, reschedule, cancel paths all tested
- [ ] RLS: cross-user isolation verified for all three journal tables
- [ ] Resume/start-fresh: both user choices tested end-to-end
- [ ] All tests pass with `pnpm test`
- [ ] Coverage for journal-related modules meets the 80% project target

## Technical Notes

- Read tasks #045 (schema), #046 (backend), and #047 (mobile) before writing tests to understand the actual implementation
- Mock OpenRouter calls using Jest mocks — do not make real AI calls in tests
- For RLS tests, use the Supabase local dev instance (`supabase start`) with two test users
- Notification tests: mock `expo-notifications` module; test the scheduling logic in the hook, not the native layer
- Follow the existing test patterns established in tasks #021 (logging tests) and #027 (reminders tests)
- Colocate unit tests with source files (`*.test.ts` / `*.test.tsx`); RLS integration tests go in `tests/` at the project root

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created |

---
id: "014"
title: "E2E tests for thought capture flow"
status: "todo"
area: "qa"
agent: "@qa-engineer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-010", "FR-011", "FR-013", "FR-014", "FR-016", "FR-020"]
blocks: []
blocked_by: ["006", "007"]
---

## Description

Write end-to-end tests for the core thought capture flow: text capture, voice capture (if automatable), thought appearing in inbox, and tags appearing after AI processing. Focus on the happy path and key error states.

## Acceptance Criteria

- [ ] Test: user can type text and submit a thought
- [ ] Test: submitted thought appears immediately in the inbox
- [ ] Test: thought shows a "pending" tag indicator immediately after capture
- [ ] Test: after AI tagging, tags appear on the thought card (poll with timeout)
- [ ] Test: empty submission is rejected with validation message
- [ ] Test: captured thought is associated with the authenticated user (not visible to others)
- [ ] Test: thought persists after app restart (data in Supabase, not just local state)
- [ ] All tests pass against test Supabase project

## Technical Notes

- Voice recording tests may require device-level mock — skip or stub if not automatable in chosen E2E framework
- AI tagging tests: use a test mode or mock the edge function to return predictable tags
- Coordinate with @react-native-developer to ensure `testID` props are on all capture UI elements

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |

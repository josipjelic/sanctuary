---
id: "013"
title: "E2E tests for authentication flow"
status: "todo"
area: "qa"
agent: "@qa-engineer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-001", "FR-002", "FR-003", "FR-004", "FR-005"]
blocks: []
blocked_by: ["005"]
---

## Description

Write end-to-end tests covering the full authentication flow: sign up, sign in, session persistence, password reset request, and sign out. The test framework (Detox or Maestro) is TBD — see open question #3 in PRD.md. Tests should use `testID` props on interactive elements for reliable selectors.

## Acceptance Criteria

- [ ] Test: new user can sign up with valid email and password
- [ ] Test: sign up with duplicate email shows error
- [ ] Test: sign up with short password shows validation error
- [ ] Test: existing user can sign in with correct credentials
- [ ] Test: sign in with wrong password shows error
- [ ] Test: "Forgot password" screen submits email and shows confirmation message
- [ ] Test: authenticated user is not shown auth screens on app restart (session persists)
- [ ] Test: user can sign out and is redirected to sign-in screen
- [ ] All tests pass against a dedicated test Supabase project (not production)
- [ ] CI integration: tests run on PR (see task #015)

## Technical Notes

- Requires E2E framework decision (open question #3): coordinate with Josip before starting
- Use a test Supabase project with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` pointing to it
- Seed test users before tests; clean up after
- `testID` props must be added to all interactive elements in auth screens (coordinate with @react-native-developer if missing)

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |

---
id: "005"
title: "Build user authentication screens (sign up, sign in, password reset)"
status: "completed"
area: "mobile"
agent: "@react-native-developer"
priority: "high"
created_at: "2026-03-28"
due_date: null
started_at: "2026-03-28"
completed_at: "2026-03-28"
prd_refs: ["FR-001", "FR-002", "FR-003", "FR-004", "FR-005"]
blocks: ["009", "012", "013"]
blocked_by: ["002", "003", "004"]
---

## Description

Build the authentication screens: Sign Up, Sign In, and Forgot Password. These screens use the Supabase auth client (from task #003) and the design system components (from task #004). The app should route unauthenticated users to Sign In, and authenticated users to the main capture screen. Include proper loading states, error handling, and form validation.

## Acceptance Criteria

- [x] Sign Up screen: email + password fields, validation, Supabase `signUp()` call, success state
- [x] Sign In screen: email + password fields, validation, Supabase `signInWithPassword()` call
- [x] Forgot Password screen: email field, Supabase `resetPasswordForEmail()` call, confirmation message
- [x] Auth guard: unauthenticated users redirected to Sign In on app launch
- [x] Authenticated users skip auth screens (session persisted via AsyncStorage)
- [x] Log Out: accessible from placeholder home screen, calls `supabase.auth.signOut()`
- [x] All screens use design system components and tokens from task #004
- [x] Loading spinners shown during async auth calls
- [x] Error messages displayed inline (not toast-only) — e.g., "Invalid credentials"
- [x] Unit tests for auth form validation logic (13 tests, all passing)

## Technical Notes

- Use Expo Router's `(auth)` route group for auth screens vs `(app)` for authenticated screens
- Auth guard pattern: check `supabase.auth.getSession()` in root layout, redirect accordingly
- Password validation: minimum 8 characters (per FR-001 — align with Supabase default)
- Email field: `keyboardType="email-address"`, `autoCapitalize="none"`

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |
| 2026-03-28 | @react-native-developer | Task completed — auth screens, AuthContext, useAuth hook, validation utils + tests |

---
id: "041"
title: "OCEAN onboarding: mobile screens + route guard + MorningMessageCard"
status: "completed"
area: "mobile"
agent: "@react-native-developer"
priority: "high"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-11"
completed_at: "2026-04-11"
prd_refs: ["FR-060", "FR-070"]
blocks: ["042"]
blocked_by: ["038", "040"]
---

## Description

Implement the full onboarding flow and morning message card.

1. New (onboarding)/ route group:
   - welcome.tsx
   - questions.tsx (stepped, one question at a time with progress stepper)
   - scoring.tsx (loading state while AI scores)
   - complete.tsx (celebration/confirmation)

2. Route guard: after auth, check for user_ocean_profiles row; redirect to onboarding if absent

3. MorningMessageCard component:
   - Shown on Quick Capture home tab (index.tsx)
   - Only during morning window (default 06:00–10:00 local)
   - Calls morning-message edge function on first open of morning
   - Result cached in component state for the session
   - Dismissible with soft gesture
   - Morning time window from user_preferences key morning_notification_time

## Acceptance Criteria

- [ ] (onboarding)/ route group with 4 screens
- [ ] Route guard implemented (no flash of main app before onboarding)
- [ ] Questions answered and stored locally before submitting to score-personality
- [ ] Loading state shown while scoring
- [ ] Profile stored → redirect to main app
- [ ] MorningMessageCard appears in morning window
- [ ] Edge function called once per morning (not on every render)
- [ ] Card is dismissible

## Technical Notes

- Use UX spec from .assets/onboarding-ocean-ux-spec.md
- Route guard in src/app/_layout.tsx or (app)/_layout.tsx using Redirect
- Check profile existence with a single Supabase select on user_ocean_profiles
- Cache today's morning message in AsyncStorage keyed by date

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created via orchestration |
| 2026-04-11 | @react-native-developer | Implemented all mobile-side code: onboarding screens (welcome, questions, scoring, complete), route guard via OnboardingContext, MorningMessageCard component, daily notification scheduling |

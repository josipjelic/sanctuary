---
id: "012"
title: "Build daily check-in screen"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-040", "FR-041", "FR-042", "FR-043"]
blocks: []
blocked_by: ["005", "004"]
---

## Description

Build the Daily Check-in screen — a calm, intentional daily ritual where users capture their current mood/emotional state and set a daily intention or theme. Opening the screen on a new day shows a fresh form. Opening it on an existing day loads the existing entry for editing. The UI should feel ceremonial and serene — the Reflection Space component from the design system is ideal here.

## Acceptance Criteria

- [ ] Mood input: free text or predefined options (to be designed — e.g., emoji scale or word list)
- [ ] Intention input: free text field for daily theme or goal
- [ ] Supabase upsert on `daily_checkins` table using `(user_id, check_in_date)` conflict resolution
- [ ] Opening on same day loads existing check-in for editing
- [ ] Save confirmation state shown after saving
- [ ] Check-in accessible from navigation (bottom tab or dedicated entry point)
- [ ] Screen adheres to design system: large whitespace, Reflection Space component
- [ ] Unit tests for date logic (ensuring correct `check_in_date` in all timezones)

## Technical Notes

- `check_in_date`: use local calendar date, not UTC — use `new Date().toLocaleDateString('en-CA')` or similar to get `YYYY-MM-DD` in local timezone
- Upsert: `supabase.from('daily_checkins').upsert({ user_id, check_in_date, mood, intention }, { onConflict: 'user_id,check_in_date' })`
- Mood design: open question — coordinate with @ui-ux-designer before building the mood input widget

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |

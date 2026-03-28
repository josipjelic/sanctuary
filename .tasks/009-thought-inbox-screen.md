---
id: "009"
title: "Build thought inbox screen"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-020", "FR-021", "FR-022"]
blocks: ["010", "011"]
blocked_by: ["005", "006"]
---

## Description

Build the Thought Inbox screen that displays all of the user's captured thoughts in reverse-chronological order. Each thought card shows the body text (truncated), AI-assigned tags, and capture time. The screen includes a search bar for keyword filtering and tag-based filtering. Pull-to-refresh fetches the latest thoughts. Tapping a thought navigates to the Thought Detail screen (task #010).

## Acceptance Criteria

- [ ] Thought list rendered using `FlatList` for performance (virtualized)
- [ ] Thoughts fetched from Supabase `thoughts` table, ordered by `created_at DESC`
- [ ] Each card displays: body preview (2-3 lines), tags, relative timestamp
- [ ] Cards with `tagging_status: 'pending'` show a subtle loading indicator instead of tags
- [ ] Pull-to-refresh supported
- [ ] Search bar: filters thoughts by keyword (client-side on loaded data, or Supabase ILIKE query)
- [ ] Tag filter pills: tapping a tag filters to thoughts with that tag
- [ ] Empty state: "Your sanctuary awaits. Capture your first thought." message
- [ ] Tapping a thought navigates to `/(app)/thoughts/[id]`
- [ ] Screen adheres to design system: no border lines, tonal separation, spacious cards

## Technical Notes

- Paginate: load 50 thoughts at a time, infinite scroll for more
- Tag filter: if using client-side filter, load all tags first; if server-side, use Supabase `contains` filter
- Thought cards: `xl` corner radius, `surface-container-lowest` on `surface-container-low` background
- No divider lines between list items — use `spacing-6` (2rem) vertical gap instead

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |

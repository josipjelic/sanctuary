---
id: "011"
title: "Build library / topic browse view"
status: "done"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: "2026-03-28"
completed_at: "2026-03-28"
prd_refs: ["FR-021", "FR-022", "FR-023", "FR-042"]
blocks: []
blocked_by: ["009"]
---

## Description

Build the **Library** screen as a third main tab: topics from the user’s `user_topics` catalog in a **folder-style bento grid** (design: `.assets/library_lists/code.html`). Tapping a topic opens a **stack** screen listing thoughts where denormalized `thoughts.topics` contains that topic’s `name`. **Manage lists** opens a sheet to **add** a new catalog topic (normalized same as edge `assign-topics`). Daily check-in history ([FR-042](PRD.md)) and an “all thoughts” library filter remain follow-ups.

## Acceptance Criteria

- [x] Topic index shows all `user_topics` with thought counts (aggregated from `thoughts.topics`)
- [x] Layout matches design asset: editorial header, Manage lists, folder cards, reflection block (`.assets/library_lists/code.html`)
- [x] Selecting a topic navigates to a filtered thought list (same card row as inbox via `ThoughtListCard`)
- [x] User can add a topic via Manage lists; duplicate normalized names show a clear error
- [x] Screen uses design tokens from `src/lib/theme.ts`
- [x] Empty topic catalog copy + empty topic detail copy
- [ ] “All” filter (full library list) — deferred
- [ ] Daily check-in history on Library ([FR-042](PRD.md)) — deferred (no check-in UI yet)

## Technical Notes

- Routes: `(app)/library/index.tsx`, `(app)/library/[topicId].tsx`, stack `_layout.tsx` under `library/`
- Counts: client-side from `select('topics')` on `thoughts` + join by `user_topics.name`
- Topic detail query: `.contains('topics', [topicName])` ordered `created_at DESC`, paginated (50)
- Normalization: `src/lib/normalizeTopicLabel.ts` ↔ `supabase/functions/_shared/assign-topics.ts`

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |
| 2026-03-28 | @react-native-developer | Implemented folder-grid Library + stack detail + add topic; updated from tag-cloud spec to asset-based topics |

---
id: "033"
title: "Shared components: ListCard, ListItemRow, list status pill"
status: "todo"
area: "frontend"
agent: "@frontend-developer"
priority: "normal"
created_at: "2026-03-31"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: ["034"]
blocked_by: ["030", "031"]
---

## Description

Implement the shared UI component library additions for the Lists feature. Three new components are needed: `ListCard.tsx` (inbox card variant for list-type thoughts), `ListItemRow.tsx` (a single checkable list item with strike-through for done state), and a list status pill (inline indicator for a fully completed list). These are consumed by the mobile screens task (#034).

Design specs come from the UX design task (#030) — do not implement visual decisions that conflict with that spec.

## Acceptance Criteria

- [ ] `src/components/ListCard.tsx` implemented: shows list title, item count, completion progress (e.g. "3 / 5 done"), topic chip, relative timestamp, optional continuation indicator; accepts `onPress` prop; follows `ThoughtListCard` layout patterns
- [ ] `src/components/ListItemRow.tsx` implemented: checkbox (accessible: `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`), item text, strike-through when `done = true`, `onToggle` callback prop; uses design tokens from `src/lib/theme.ts`
- [ ] List status pill component (inline or part of `ListCard`): visual treatment for `status === 'done'` (all items complete); spec from #030
- [ ] All new tokens (if any) drawn from existing `src/lib/theme.ts`; no new hardcoded colour or spacing values
- [ ] Components exported from `src/components/index.ts` barrel
- [ ] Unit tests: `ListCard.test.tsx`, `ListItemRow.test.tsx` — render smoke tests and checkbox toggle behaviour
- [ ] No `console.log` in production code; use logger utility

## Technical Notes

- `ThoughtListCard.tsx` is the closest sibling — use it as a structural reference.
- `ListItemRow` checkbox interaction: the component fires `onToggle(id, newDone)` and is controlled (caller manages state). No internal state for `done`.
- Strike-through: use `textDecorationLine: 'line-through'` with reduced opacity on done item text (exact values from the UX spec in #030).
- `ListCard` should handle the case where `list_detection_status === 'pending'` gracefully — a subtle loading indicator or simply rendering without item count is acceptable; confirm with UX spec.
- Continuation indicator (if specified in #030): a small tag or pill appended to the card — e.g. "Added to [Title]" — using `colors.primaryContainer` background.
- All components must work on both iOS and Android; avoid web-only style properties.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-31 | human | Task created |

---
id: "034"
title: "Mobile screens: list inbox card, list detail, item completion"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-31"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: ["035", "036"]
blocked_by: ["032", "033"]
---

## Description

Implement the mobile-facing surfaces for the Lists feature. This covers rendering lists distinctly in the thought inbox (using `ListCard`), a dedicated list detail screen where users can check off items, and the Supabase client logic to persist item completion and list status transitions.

Do not start until both the backend task (#032) and shared components task (#033) are complete.

## Acceptance Criteria

- [ ] Inbox (`src/app/(app)/inbox/index.tsx`): detects when a thought has an associated list (`list_detection_status === 'complete'` and a linked `user_lists` row) and renders `ListCard` instead of `ThoughtListCard`; falls back to `ThoughtListCard` for non-list thoughts
- [ ] List detail screen (`src/app/(app)/inbox/[thoughtId].tsx` or a new route `src/app/(app)/lists/[listId].tsx` — choose the better UX per design spec #030): displays all `list_items` ordered by `position`, each rendered as `ListItemRow`
- [ ] Item toggle: tapping a checkbox updates `list_items.done` and `list_items.updated_at` via Supabase client; optimistic UI update (toggle immediately, revert on error)
- [ ] List completion: when all items are toggled done, the client sets `user_lists.status = 'done'` and `updated_at`; when any item is un-toggled, status reverts to `'active'`
- [ ] Pull-to-refresh on list detail reloads items from Supabase
- [ ] Continuation: if the inbox card has a continuation indicator (per #030 spec), it is rendered correctly
- [ ] Empty state: list with no items (edge case from failed detection partial write) renders gracefully
- [ ] No `console.log` in production code

## Technical Notes

- Supabase query to load a list with items:
  ```typescript
  const { data } = await supabase
    .from('user_lists')
    .select('*, list_items(id, text, done, position)')
    .eq('id', listId)
    .order('position', { referencedTable: 'list_items', ascending: true })
    .single();
  ```
- Item toggle update pattern:
  ```typescript
  await supabase
    .from('list_items')
    .update({ done: newDone, updated_at: new Date().toISOString() })
    .eq('id', itemId);
  ```
- List completion check: after each toggle, check if `items.every(i => i.done)` and upsert `user_lists.status` accordingly.
- Inbox detection: the `thoughts` query already returns `list_detection_status`; a separate join to `user_lists` by `thought_id` is needed to get the `list_id` for navigation. Consider fetching `user_lists` in a second pass or via a Supabase join (`thoughts!inner(user_lists(id, title, status))`) — choose the simpler approach and note it in code comments.
- Route choice: if list detail reuses `inbox/[thoughtId].tsx`, render a conditional branch. If a new `lists/[listId].tsx` route is used, update `(app)/_layout.tsx` accordingly.
- RLS enforces `user_id = auth.uid()` on both `user_lists` and `list_items` — no extra client-side filtering needed beyond the standard authenticated session.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-31 | human | Task created |

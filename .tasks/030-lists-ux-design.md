---
id: "030"
title: "UX design for lists feature"
status: "todo"
area: "design"
agent: "@ui-ux-designer"
priority: "normal"
created_at: "2026-03-31"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: ["033", "034"]
blocked_by: []
---

## Description

Design the UX and component specs for the Lists feature. Lists are a distinct content type from thoughts — they have a title, individual checkable items, and a completion state. The design must distinguish lists from regular thoughts in the inbox, provide a clear list detail view with checkboxes, and communicate continuation (when a new recording is detected as adding items to an existing list).

Deliverables are design specs and/or annotated wireframes committed to `.assets/` (following the existing pattern of `.assets/quick_capture_home/`, `.assets/library_lists/`, `.assets/reminders-ux-spec.md`).

## Acceptance Criteria

- [ ] Inbox list card variant spec: how a list differs visually from a regular thought card (`ThoughtListCard`) — title display, item count, completion pill/progress indicator, bell/topic chip placement
- [ ] List detail view spec: items with checkboxes, strike-through for done items, "Mark all done" affordance, list title editable or read-only (decide and specify), list status (active vs done) display
- [ ] Continuation indicator spec: how the inbox card or detail surface communicates "items were added to an existing list"
- [ ] List status pill spec: visual treatment for a fully completed list (all items done)
- [ ] Component spec for `ListCard.tsx` and `ListItemRow.tsx` delivered (used by @frontend-developer in task #033)
- [ ] Design tokens: confirm all values draw from existing `src/lib/theme.ts`; flag any new tokens needed
- [ ] Spec file committed to `.assets/lists-ux-spec.md` (or equivalent)

## Technical Notes

- Study existing design assets: `.assets/quick_capture_home/code.html`, `.assets/library_lists/code.html`, `.assets/reminders-ux-spec.md` for style and spec format.
- The Serene Interface principles apply: breathtaking whitespace, no border lines (separation via background shifts), `xl`/`lg` corner radius, Manrope + Plus Jakarta Sans typography.
- Checkboxes must be accessible (`accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`).
- Consider how lists appear when `list_detection_status` is `'pending'` (detection still running) vs `'complete'` — should there be a loading state on the card?
- The continuation indicator should be subtle — the calm, intentional brand does not favour loud "UPDATED" badges.
- Coordinate with the existing `ThoughtListCard` design so the list card variant is recognisably related but clearly distinct.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-31 | human | Task created |

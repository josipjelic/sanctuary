---
id: "036"
title: "Docs: USER_GUIDE.md Lists section"
status: "todo"
area: "docs"
agent: "@documentation-writer"
priority: "normal"
created_at: "2026-03-31"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: []
blocked_by: ["034"]
---

## Description

Add a Lists section to `docs/user/USER_GUIDE.md` once the mobile implementation (task #034) is complete and the feature is stable. This is blocked by #034 — do not document behaviour that has not shipped.

Section content should cover:
- How Sanctuary automatically detects when a captured thought is a list
- What happens after detection: items appear as checkable rows on the list detail screen
- How to check off individual items
- How marking all items done marks the whole list as done
- Continuation: if you record a new thought mentioning an existing list title, Sanctuary appends the new items to that list rather than creating a duplicate
- How to find your lists (inbox card variant, navigation to list detail)
- Any current limitations (e.g. no manual reordering of items in v1, list title cannot be edited, etc.)

Also update:
- The Troubleshooting table with a row for "List was not detected" (expected: AI found no clear list structure; suggestion: try a more explicit list format)
- The version/date header in `USER_GUIDE.md`

## Acceptance Criteria

- [ ] "Lists" section added to `docs/user/USER_GUIDE.md` (after "Reminders", before "Daily Check-in")
- [ ] Section covers: detection, item completion, list done state, continuation, how to navigate to a list
- [ ] Troubleshooting entry added for list detection failure
- [ ] `USER_GUIDE.md` version date updated
- [ ] Content is accurate to the shipped implementation (no speculative features documented)
- [ ] Writing matches the calm, plain-language tone of the rest of the guide

## Technical Notes

- Read tasks #032 (backend), #033 (components), and #034 (mobile) for accurate behaviour details before writing
- Precedent section: "Reminders" in `USER_GUIDE.md` — match the heading level, structure, and tone
- Do not document the `list_detection_status` database column or internal AI mechanics; the guide is end-user facing

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-31 | human | Task created |

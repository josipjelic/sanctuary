---
id: "010"
title: "Complete thought detail / journaling screen"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-030", "FR-031", "FR-032", "FR-033", "FR-034"]
blocks: []
blocked_by: ["009", "008"]
---

## Description

Finish the Thought Detail experience on top of the **minimal screen** already shipped at `src/app/(app)/inbox/[thoughtId].tsx` (opens from the Thoughts tab inbox). That route shows the full body, read-only **topic** chips (from denormalized `thoughts.topics`), manual edit/save for the main body, and delete with confirmation.

Remaining work: journaling (`body_extended`), debounced auto-save, topic editing aligned with `user_topics` / `thought_topics`, AI reflection prompt via the `reflection-prompt` edge function (stubbed in `docs/technical/API.md`), Reflection Space styling per design system, and tests.

## Shipped (do not re-implement)

- [x] Full thought `body` displayed (not truncated)
- [x] Manual edit flow for `body` (enter edit mode, Save/Cancel in header)
- [x] Primary **topics** shown as read-only chips (`Topic` component)
- [x] Delete with confirmation; navigates back after success
- [x] Modal stack presentation from inbox (`inbox/_layout.tsx`)

## Remaining acceptance criteria

- [ ] `body_extended`: inline area for longer journal reflection; persisted to `thoughts.body_extended`
- [ ] Auto-save: debounce (~1s) and sync edits to Supabase (body and/or extended body per product choice)
- [ ] Topic UX: align with catalog model — either read-only with clear copy, or controlled editing that updates `thought_topics` / `thoughts.topics` (not legacy “tags”)
- [ ] “Get reflection prompt” button: `supabase.functions.invoke('reflection-prompt', …)` after the edge function exists; display inline
- [ ] Reflection Space layout: `.assets/DESIGN.md` (Reflection Space — ~60%+ viewport, xl padding, parchment)
- [ ] Unit tests for debounced auto-save (or equivalent persistence helper)

## Technical notes

- Auto-save: `useRef` debounce timer + `supabase.from('thoughts').update(...)`; avoid duplicate in-flight writes
- Topics: see `docs/technical/DATABASE.md` and `_shared/assign-topics.ts` — v1 assigns one primary topic via AI; manual edits are out of scope unless explicitly specified in PRD
- AI prompt: implement `supabase/functions/reflection-prompt` when building this task; keep `docs/technical/API.md` in sync
- Do not reference `thoughts.tags` — column was renamed to **`topics`** (`text[]`)

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |
| 2026-03-30 | agent | Split shipped vs remaining; tags → topics; point to `inbox/[thoughtId].tsx` |

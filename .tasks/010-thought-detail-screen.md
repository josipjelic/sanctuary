---
id: "010"
title: "Build thought detail / journaling screen"
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

Build the Thought Detail screen, which opens when a user taps a thought in the inbox. It shows the full thought text, editable tags, a journaling expansion area (where the user can write a longer reflection), and an AI reflection prompt button. Edits are auto-saved (debounced). The user can delete the thought from this screen with a confirmation dialog.

## Acceptance Criteria

- [ ] Full thought body displayed (not truncated)
- [ ] Inline editable text area for expanding the thought into a journal entry (`body_extended` field)
- [ ] Auto-save: changes debounced by 1s and synced to Supabase
- [ ] Tags displayed as chips — tap to remove; text input to add new tags
- [ ] Manual tag additions saved to `thoughts.tags`
- [ ] "Get reflection prompt" button: calls Supabase edge function (or inline OpenRouter call) and displays a prompt inline
- [ ] Delete button (with confirmation dialog): removes thought from Supabase, navigates back to inbox
- [ ] Screen adheres to design system: Reflection Space component (60%+ viewport, xl padding, parchment)
- [ ] Unit tests for auto-save debounce logic

## Technical Notes

- Auto-save: use `useRef` for debounce timer, call `supabase.from('thoughts').update(...)` on change
- The Reflection Space component is defined in the design system spec (`.assets/DESIGN.md` §5)
- AI prompt: call edge function `reflection-prompt` with thought text; display as styled quote
- Tag chips: inline tag editing — remove with tap, add with small `+` input that appears on tap

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |

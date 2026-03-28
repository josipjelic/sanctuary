---
id: "008"
title: "Implement AI auto-tagging via OpenRouter"
status: "done"
area: "backend"
agent: "@backend-developer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: "2026-03-28"
completed_at: "2026-03-28"
prd_refs: ["FR-013", "FR-016"]
blocks: ["010"]
blocked_by: ["007"]
---

## Description

Build the Supabase Edge Function `tag-thought` that receives a thought ID and its text content, sends it to OpenRouter (a fast language model — gpt-4o-mini, claude-3-haiku, or similar), and receives back an array of tags. Tags are stored on the `thoughts.tags` column and `tagging_status` is updated to `'complete'`. This function is called after a thought is captured (text capture) or after transcription completes (voice capture).

## Acceptance Criteria

- [x] Supabase Edge Function `tag-thought` created at `supabase/functions/tag-thought/index.ts`
- [x] Function authenticates caller via Supabase JWT
- [x] Prompt engineering: system prompt instructs the model to return 1-4 lowercase tags as a JSON array
- [x] Tags are meaningful and consistent (e.g., `["grocery"]`, `["idea", "product"]`, `["feeling", "reflection"]`)
- [x] `thoughts.tags` updated with returned tag array
- [x] `tagging_status` set to `'complete'` on success, `'failed'` on error
- [x] Model ID configurable via `OPENROUTER_TAGGING_MODEL` Supabase secret
- [x] `docs/technical/API.md` `/tag-thought` section updated
- [ ] Unit tests with mocked OpenRouter responses covering: single tag, multiple tags, empty/error response

## Technical Notes

- See open question #2 in PRD.md for model selection — use a fast, cheap model (haiku/mini class)
- Prompt should instruct: return ONLY a JSON array of strings, no prose, no explanation
- Tag normalization: lowercase, trim whitespace, deduplicate before saving
- Edge case: if OpenRouter returns malformed JSON, set `tagging_status: 'failed'` and log

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |
| 2026-03-28 | @backend-developer | Implemented tag-thought edge function |

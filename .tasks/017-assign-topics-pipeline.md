---
id: "017"
title: "assign-topics + transcribe topic pipeline + mobile wiring"
status: "done"
area: "backend"
agent: "@backend-developer"
priority: "high"
created_at: "2026-03-28"
completed_at: "2026-03-28"
prd_refs: ["FR-013", "FR-016"]
---

## Description

Shared `assign-topics` module (`_shared/assign-topics.ts`), `assign-topics` edge function for text capture, topic assignment inside `transcribe` after transcript, remove `tag-thought`, client invokes `assign-topics` for text only. Threshold 0.2 for reusing vs creating topics (see ADR-002).

## Acceptance Criteria

- [x] `_shared/assign-topics.ts` with OpenRouter structured JSON + DB writes
- [x] `assign-topics` edge function
- [x] `transcribe` calls shared module after successful transcript
- [x] `supabase/config.toml` `[functions.assign-topics]`
- [x] Mobile: `assign-topics` on text; no post-transcribe topic invoke
- [x] `Topic` component + inbox `topics` / `tagging_status` pending UI
- [x] `docs/technical/API.md`, ADR-002

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | implementation | Completed |

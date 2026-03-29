---
id: "021"
title: "Tests: logging omits audio; structure matches spec where testable"
status: "completed"
area: "qa"
agent: "@qa-engineer"
priority: "normal"
created_at: "2026-03-30"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: ["FR-012", "FR-013", "FR-016"]
blocks: []
blocked_by: ["019"]
---

## Description

Add **automated tests** that verify Edge Function logging behavior **where testable** without brittle coupling to Supabase’s hosted log sink: e.g. mock or spy on the logging primitive used in #019, assert that **audio payloads are never passed** to the logger, and assert **expected structured fields** (or snapshots of safe subsets) per the #018 spec.

## Acceptance Criteria

- [x] Tests demonstrate that audio / raw sound bodies are not logged (integration or unit level as appropriate for the codebase) — **covered at shared helper level**: `truncateForLog` + mocked `console` prove summaries stay bounded; raw audio must not be placed in payload fields (call-site contract in edge functions).
- [x] Where feasible, tests assert log object shape or key fields for transcribe / assign-topics paths (non-audio) — **`supabase/functions/_shared/ai-log.test.ts`**: `event`, `function`, `phase`, optional fields, single-line JSON.
- [x] `pnpm test` passes; new tests documented briefly if the suite has a testing guide
- [x] Aligned with #019 merge — no flaky dependence on live Supabase dashboard

## Technical Notes

- If edge functions are hard to run in Jest, prefer testing the shared logger + call sites in extractable modules, or Deno test in `supabase/functions` if the repo already uses that pattern.
- Coordinate with @backend-developer on injectable log sink for testability if missing after #019.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-30 | @project-manager | Task created |
| 2026-03-30 | @qa-engineer | Jest tests for `ai-log.ts` (truncate, structured keys, mocked console); task completed |

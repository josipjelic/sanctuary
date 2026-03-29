---
id: "020"
title: "Document AI logging visibility and privacy in API / ops notes"
status: "completed"
area: "docs"
agent: "@documentation-writer"
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

After backend instrumentation (#019) is in place, update **developer and operator-facing documentation** so the team knows where AI I/O logs appear (Supabase Edge Function logs / dashboard), what fields exist, and **privacy guarantees** (no raw audio in logs; metadata-only rules for voice).

Primary file: `docs/technical/API.md`. Add a **brief ops note** elsewhere only if the project already has a natural home (e.g. ARCHITECTURE cross-link); avoid new doc sprawl.

## Acceptance Criteria

- [x] `docs/technical/API.md` describes logging for transcribe / assign-topics (or points to DECISIONS/ARCHITECTURE for full spec) including privacy constraints
- [x] Any short ops pointer is consistent with #018/#019 and does not duplicate PRD.md
- [ ] PR reviewed with #019 implementation

## Technical Notes

- Coordinate wording with `docs/technical/DECISIONS.md` and `docs/technical/ARCHITECTURE.md` after #018/#019 land — single source of truth for policy, docs summarize for API consumers and operators.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-30 | @project-manager | Task created |
| 2026-03-30 | @documentation-writer | API.md observability section; task marked completed |

---
id: "018"
title: "AI I/O observability via Supabase Edge Function logging (architecture)"
status: "todo"
area: "infra"
agent: "@systems-architect"
priority: "normal"
created_at: "2026-03-30"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-012", "FR-013", "FR-016"]
blocks: ["019"]
blocked_by: []
---

## Description

Define how Sanctuary records AI-related inputs and outputs for operations and debugging using **Supabase Edge Function logging** (dashboard logs), not ad-hoc storage of full payloads in the database. The approach must respect privacy: **do not log raw audio or sound payloads**; for voice flows, only **metadata** (e.g. duration, format hints, request IDs, sizes without content) where needed.

This task produces the written decisions and architecture updates so backend implementation (#019) follows a single spec.

## Acceptance Criteria

- [ ] ADR or `docs/technical/DECISIONS.md` entry describing: what is logged, log levels/structure, where logs appear (Supabase dashboard), and explicit prohibition on raw audio in logs
- [ ] `docs/technical/ARCHITECTURE.md` updated to reference AI I/O observability and Edge Function logging boundaries
- [ ] Clear handoff for #019: field names, redaction rules, and which functions/modules are in scope (`transcribe`, `assign-topics`, shared OpenRouter/topic helpers)

## Technical Notes

- Align with existing OpenRouter / transcribe / assign-topics boundaries (see completed #007, #008, #017).
- Supabase Edge Functions surface `console` output to project logs; structured JSON lines aid filtering in the dashboard.
- Voice: document acceptable metadata only (no base64, no binary dumps, no transcript-in-log if policy says transcripts are sensitive — clarify in ADR per product stance; default lean is metadata-only for voice **input**).

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-30 | @project-manager | Task created |

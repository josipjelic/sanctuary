---
id: "019"
title: "Instrument edge functions with structured AI I/O logging (no audio bodies)"
status: "todo"
area: "backend"
agent: "@backend-developer"
priority: "normal"
created_at: "2026-03-30"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-012", "FR-013", "FR-016"]
blocks: ["020", "021"]
blocked_by: ["018"]
---

## Description

Implement **structured `console` logging** on Supabase Edge Functions per the architecture/spec from #018: log AI-related inputs and outputs (e.g. model id, token usage summaries, topic counts, error codes, correlation IDs) so they appear in **Supabase dashboard logs**. **Never log raw audio or sound payloads**; for voice paths, log **metadata only** (e.g. content-type, size, duration if available) as agreed in #018.

Scope includes `transcribe`, `assign-topics`, and **shared** OpenRouter / topic-assignment code used by those functions.

## Acceptance Criteria

- [ ] `transcribe` and `assign-topics` (and shared modules they use) emit structured logs matching the #018 spec
- [ ] No logging of audio bytes, base64 audio, or full multipart bodies containing sound
- [ ] Text/JSON AI responses logged in a redacted or truncated form per #018 (if full content is excluded by policy)
- [ ] Relevant tests passing (`pnpm test`, lint, typecheck as required by project conventions)
- [ ] Implementation merged only after review; documentation tasks #020/#021 can proceed

## Technical Notes

- Use a small shared logger helper if it reduces duplication and keeps field names consistent.
- Follow `docs/technical/DECISIONS.md` after #018 merges; avoid `console.log` patterns that violate CLAUDE.md (use structured logging utility if the codebase already defines one for edge functions).

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-30 | @project-manager | Task created |

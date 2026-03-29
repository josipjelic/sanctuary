---
id: "016"
title: "User-scoped topics schema (user_topics, thought_topics, tags→topics)"
status: "done"
area: "database"
agent: "@database-expert"
priority: "high"
created_at: "2026-03-28"
completed_at: "2026-03-28"
prd_refs: ["FR-013"]
---

## Description

Add `user_topics` and `thought_topics` with RLS, backfill from legacy `thoughts.tags`, rename column `tags` → `topics`, and keep denormalized `thoughts.topics` in sync with the junction table for inbox queries.

## Acceptance Criteria

- [x] Migration `003_user_topics_rename_tags.sql`
- [x] `docs/technical/DATABASE.md` updated

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | implementation | Shipped with ADR-002 / #017 |

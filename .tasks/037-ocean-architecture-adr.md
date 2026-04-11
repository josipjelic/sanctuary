---
id: "037"
title: "OCEAN onboarding: architecture ADR-005"
status: "completed"
area: "infra"
agent: "@systems-architect"
priority: "high"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-11"
completed_at: "2026-04-11"
prd_refs: ["FR-060", "FR-070"]
blocks: ["038", "039", "040", "041", "042"]
blocked_by: []
---

## Description

Author ADR-005 covering the OCEAN personality onboarding subsystem. Decide:
1. OCEAN scoring approach: AI-analyzed free-text answers vs. pre-mapped Likert scale
2. Morning message delivery mechanism: app-open card vs. push notification
3. Onboarding route guard pattern in Expo Router (where to check, how to redirect)
4. Question set design (5-7 questions mapping to OCEAN dimensions)

## Acceptance Criteria

- [x] ADR-005 appended to docs/technical/DECISIONS.md
- [x] ARCHITECTURE.md updated with OCEAN onboarding subsystem overview
- [x] Scoring method clearly specified (AI or Likert)
- [x] Morning message delivery mechanism specified
- [x] Route guard approach documented

## Technical Notes

- Reuse existing user_preferences table for morning time preference
- Follow ADR-004 patterns (expo-notifications) for any notification delivery
- OpenRouter is available for AI scoring

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created via orchestration |
| 2026-04-11 | @systems-architect | Started |
| 2026-04-11 | @systems-architect | Completed — ADR-005 appended to DECISIONS.md; OCEAN subsystem section added to ARCHITECTURE.md |

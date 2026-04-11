---
id: "040"
title: "OCEAN onboarding: backend edge functions"
status: "completed"
area: "backend"
agent: "@backend-developer"
priority: "high"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-11"
completed_at: "2026-04-11"
prd_refs: ["FR-060", "FR-070"]
blocks: ["041"]
blocked_by: ["037", "039"]
---

## Description

Implement two Supabase edge functions:

1. score-personality: POST
   - Input: { answers: [{ question: string, answer: string }] }
   - Prompts OpenRouter to return OCEAN scores { openness, conscientiousness, extraversion, agreeableness, neuroticism } (0-100 each)
   - Inserts row into user_ocean_profiles
   - Returns { profile: { openness, conscientiousness, extraversion, agreeableness, neuroticism } }

2. morning-message: POST
   - Input: none (fetches OCEAN profile from DB using user JWT)
   - Fetches user's OCEAN profile from user_ocean_profiles
   - Prompts OpenRouter for a short (2-3 sentence) personalised motivational message
   - Returns { message: string } — stateless, does not persist

Both must follow ADR-003 structured logging contract.

## Acceptance Criteria

- [x] supabase/functions/score-ocean-profile/index.ts implemented
- [x] supabase/functions/generate-morning-message/index.ts implemented
- [x] Both functions require valid Supabase session token
- [x] Structured logging per ADR-003
- [x] docs/technical/API.md updated with both endpoints
- [x] Error handling: missing profile → graceful 404

## Technical Notes

- Follow existing edge function patterns from assign-topics, detect-reminders
- Use OPENROUTER_PERSONALITY_MODEL env var → fallback to OPENROUTER_TOPIC_MODEL → google/gemini-2.0-flash-001
- morning-message is stateless: generates fresh each call, no caching in DB
- Logging phase: "onboarding" for score-personality, "morning-message" for morning-message

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created via orchestration |
| 2026-04-11 | @backend-developer | Implemented score-ocean-profile and generate-morning-message edge functions; updated API.md; added config.toml entries |

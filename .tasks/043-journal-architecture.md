---
id: "043"
title: "AI-guided journal: architecture + ADR"
status: "done"
area: "infra"
agent: "@systems-architect"
priority: "normal"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-11"
completed_at: "2026-04-11"
prd_refs: ["FR-030", "FR-060", "FR-061", "FR-062", "FR-063", "FR-073"]
blocks: ["044", "045"]
blocked_by: []
---

## Description

Design and document the full architecture for the AI-Guided Journal feature. This is the foundational task that unblocks all implementation work. The deliverables are an ADR entry in `docs/technical/DECISIONS.md` and updated sections in `docs/technical/ARCHITECTURE.md`.

The architecture must cover:

- **AI conversation model**: fixed opening question → AI chooses up to 2 follow-up questions (max 3 turns total) based on user answers and their current `user_state` snapshot. AI must never assume life situation; questions should be open and non-presumptuous.
- **User state memory layer**: a 200-word living analysis updated after every completed journal session. Stored in a `user_state` table. Used as context when forming follow-up questions. Visible read-only to the user in Settings/Profile. AI must check prior unresolved problems/struggles (surfaced from user state) when deciding follow-up questions.
- **Evening reminder pattern**: configurable daily local notification (user-set time). Scheduling must integrate with Expo Notifications. Document how preference is stored and how the mobile layer schedules/reschedules.
- **Resume/start-fresh logic**: if a session was interrupted (started but not completed), the app prompts the user on next open: resume or start fresh. Document the session state machine (`pending → active → completed | abandoned`).
- **Session/history separation**: journal sessions have their own history screen, separate from the Thoughts inbox. Document navigation and data access pattern.
- **Schema guidelines** for the database task (#045): `journal_sessions`, `journal_entries`, `user_state` tables — columns, relationships, indexes, RLS approach.
- **Edge function contracts** for the backend task (#046): `journal-next-question` (input/output JSON shape) and `journal-save-session` (triggers user state update).
- **ADR-003 logging**: all AI calls in journal edge functions must follow the existing observability pattern (ADR-003 from task #018/#019).

## Acceptance Criteria

- [ ] ADR written and merged into `docs/technical/DECISIONS.md` covering: AI conversation model, max-turns enforcement, user state memory design, evening reminder scheduling pattern, session state machine, resume/start-fresh logic
- [ ] `docs/technical/ARCHITECTURE.md` updated: edge function inventory includes `journal-next-question` and `journal-save-session`; Journal subsystem section added
- [ ] Schema guidelines documented for `journal_sessions`, `journal_entries`, `user_state` tables (sufficient for @database-expert to implement without further clarification)
- [ ] Edge function request/response JSON contracts specified for both `journal-next-question` and `journal-save-session`
- [ ] User state update strategy documented: when triggered, how the 200-word summary is generated/replaced, privacy considerations
- [ ] Evening reminder scheduling approach documented (Expo Notifications + user_preferences storage)
- [ ] Session state machine documented with all states and transitions

## Technical Notes

- Mirror the Reminders subsystem ADR and ARCHITECTURE section as the structural template (see task #022 and `.tasks/022-reminders-architecture.md`).
- The `journal-next-question` edge function receives: session ID, all prior Q&A turns so far, user's `user_state` snapshot. It returns: either the next question text or a signal that the session is complete (max turns reached or AI judges further questions unnecessary).
- The `journal-save-session` edge function receives the completed session and triggers a fire-and-forget user state update (call an AI to regenerate the 200-word analysis from prior sessions + new session). The state update must be non-blocking to the save response.
- Max-3-turns rule must be enforced server-side, not just in the mobile client.
- The user state snapshot passed to `journal-next-question` must NOT include raw session transcripts (only the 200-word analysis) to keep token usage bounded.
- Consider: should `journal_entries` store questions and answers as separate rows (type: `question` | `answer`) or as paired JSON objects per turn? The ADR should propose one approach and justify it.
- Evening reminder time is a user preference (stored in `user_preferences` alongside existing reminder prefs). The mobile layer schedules a recurring local notification at that time using Expo Notifications; no server-side push is needed for v1.

## Decisions Made

| Decision | Choice | Rationale summary |
|----------|--------|-------------------|
| AI conversation model | Stateless single-shot per turn | Bounded token usage (≤3 turns); consistent with existing edge function patterns; server-enforced 3-turn cap |
| User state update | Incremental merge | Token cost stays bounded as session count grows; no new infrastructure; incremental 200-word → 200-word merge via OpenRouter |
| Opening question | "Take a moment to settle in. What's on your mind today — something that happened, a feeling, or just a thought that's been with you?" | Brand-aligned ("settle in"), three entry points (event/feeling/thought), non-presumptuous, works at any time of day |
| Resume/start-fresh | Incremental persistence (write each Q&A immediately) | Only approach enabling genuine resume; cost (~6 DB writes/session) negligible at beta scale |
| Evening reminder | DailyTriggerInput local notification (same pattern as ADR-005 morning) | No server-side scheduler required; `evening_notification_id` + `evening_notification_time` in `user_preferences` |

## Files Updated

- `docs/technical/DECISIONS.md` — ADR-006 appended (4 sub-decisions); Decision Index updated
- `docs/technical/ARCHITECTURE.md` — Architecture diagram updated; Edge Function Inventory updated (2 new functions); Journal Subsystem section added; Product deltas updated

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created |
| 2026-04-11 | @systems-architect | ADR-006 written; ARCHITECTURE.md Journal Subsystem section added; task marked done |

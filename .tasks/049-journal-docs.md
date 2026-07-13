---
id: "049"
title: "AI-guided journal: USER_GUIDE.md journal section"
status: "completed"
area: "docs"
agent: "@documentation-writer"
priority: "normal"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-12"
completed_at: "2026-04-12"
prd_refs: []
blocks: []
blocked_by: ["047"]
---

## Description

Add a Journal section to `docs/user/USER_GUIDE.md` once the mobile implementation (task #047) is complete and the feature is stable. Do not document behaviour that has not shipped.

Section content should cover:

- **What the Journal is**: a guided, private journaling space — not a chat, not a task list. Briefly explain the AI-guided format (AI asks an opening question, may ask up to 2 follow-ups based on your answers).
- **How to start a session**: tap the Journal tab, answer the opening question, continue the conversation at your own pace.
- **Finishing a session**: you can finish at any point; sessions auto-complete after 3 questions.
- **Interrupted sessions**: if you leave mid-session, you'll be prompted to resume or start fresh next time you open the Journal.
- **Evening reminder**: how to enable the daily journal reminder, how to set the time, and what to expect (a local notification at the configured time).
- **Journal history**: where to find past sessions, what information is shown, that sessions are read-only after completion.
- **Your Sanctuary Profile (User State)**: what it is (a short AI summary of patterns in your journal sessions, updated after each session), where to find it in Settings, that it's private and never shared, and how to reset it if desired.
- **What the AI does and doesn't know**: the AI learns about you only from what you share in journal sessions. It never assumes your life situation. It may reference themes from past sessions to ask more relevant questions.

Also update:
- The Troubleshooting table with a row for "AI question seems generic / doesn't reference past sessions" (expected if this is a first session or user state is empty; state builds over multiple sessions)
- The version/date header in `USER_GUIDE.md`

## Acceptance Criteria

- [x] "Journal" section added to `docs/user/USER_GUIDE.md` (suggested placement: after "Reminders", before "Daily Check-in" or wherever appropriate in the guide flow)
- [x] Section covers: how to start, conversation format, finishing, resume/start-fresh, evening reminder, journal history, user state/profile
- [x] Troubleshooting entry added for generic AI questions
- [x] `USER_GUIDE.md` version date updated
- [x] Content is accurate to the shipped implementation (no speculative features documented)
- [x] Writing matches the calm, plain-language tone of the rest of the guide
- [x] No internal technical details exposed (no mention of edge functions, database columns, or AI model names)

## Technical Notes

- Read tasks #046 (backend), #047 (mobile), and the architecture ADR (task #043) for accurate behaviour details before writing
- Precedent section: "Reminders" in `USER_GUIDE.md` — match the heading level, structure, and tone
- The "Your Sanctuary Profile" section must be demystifying and reassuring: users should understand the AI summary is a tool to improve their journaling experience, not surveillance
- Do not describe the max-3-questions limit as a constraint; frame it as the session naturally concluding when the conversation has reached a good resting point

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created |
| 2026-04-12 | @documentation-writer | Journal section added to USER_GUIDE.md; troubleshooting row and Settings section updated; version date bumped |

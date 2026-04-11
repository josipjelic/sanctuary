---
id: "044"
title: "AI-guided journal: UX design"
status: "done"
area: "design"
agent: "@ui-ux-designer"
priority: "normal"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-11"
completed_at: "2026-04-11"
prd_refs: ["FR-030", "FR-060", "FR-061", "FR-062", "FR-063", "FR-073"]
blocks: ["047"]
blocked_by: ["043"]
---

## Description

Design the UX and produce component/interaction specifications for all new screens and flows introduced by the AI-Guided Journal feature. Deliverables are annotated wireframes or specs in `docs/technical/DESIGN_SYSTEM.md` (or a linked design artefact) that @react-native-developer can implement without requiring further UX clarification.

Screens and flows to design:

1. **Journal tab entry point** — 4th tab in the bottom nav (icon TBD; suggest a notebook or pen motif). What does the default state look like? (Empty state vs. showing last session date.)
2. **Journal conversation screen** — the core journaling experience:
   - Fixed opening question displayed first
   - User answer input (text; voice optional in v1)
   - AI follow-up question appears after answer is submitted
   - Progress indicator (e.g. turn 1 of max 3) — subtle, non-anxiety-inducing
   - "Finish session" affordance available at any point (user may end before max turns)
   - Visual rhythm: calm, distraction-free, serene — consistent with the app's sanctuary aesthetic
3. **Resume / start-fresh prompt** — modal or sheet shown when an interrupted session is detected on app open or tab tap. Clear, low-pressure language.
4. **Journal history screen** — list of past completed sessions (date, first question shown as preview). Tap to view full session Q&A read-only.
5. **Evening reminder settings** — a new row/section in the existing Settings screen: toggle + time picker for the daily journal reminder. Shown alongside existing reminder preferences.
6. **User state profile view** — read-only panel in Settings/Profile showing the current 200-word AI analysis of the user. Clear label: "Your Sanctuary profile" or similar. Includes an explanatory note about what it is and that the user can reset it.

## Acceptance Criteria

- [ ] Journal tab icon and tab bar placement specified (4th tab)
- [ ] Journal conversation screen fully spec'd: empty state, opening question, answer input, follow-up question appearance, turn indicator, finish-early affordance, session complete state
- [ ] Resume/start-fresh prompt designed with copy suggestions
- [ ] Journal history screen spec'd: list layout, session preview format, full session read-only view
- [ ] Evening reminder settings designed: toggle + time picker, placement in Settings
- [ ] User state profile view designed: layout, explanatory copy, reset affordance
- [ ] All designs consistent with the app's calm/sanctuary aesthetic and existing design tokens
- [ ] Accessibility notes included (contrast, tap target sizes, screen reader labels for AI-generated text)
- [ ] Specs are sufficient for @react-native-developer to implement without further UX clarification

## Technical Notes

- Read `docs/technical/DESIGN_SYSTEM.md` for existing design tokens (colours, typography, spacing, component patterns)
- Read `docs/technical/ARCHITECTURE.md` (after task #043 completes) for the session state machine and data model before designing state transitions
- The conversation screen should feel like a calm, unhurried dialogue — not a form or a chat bubble interface. Consider full-screen question display with a simple text input below.
- The turn indicator (e.g. "Question 1 of up to 3") must not feel like a countdown creating pressure. Consider soft language like "Taking your time…" or simply omitting numbers.
- The user state profile view should be demystifying — users should understand what the AI stores and why; avoid making it feel surveillance-like.
- Voice input for journal answers is out of scope for v1 unless the architecture ADR (#043) explicitly includes it.

## Acceptance Criteria Status

- [x] Journal tab icon and tab bar placement specified (4th tab, `Ionicons book-outline`/`book`)
- [x] Journal conversation screen fully spec'd: State A/B home, opening question, answer input (≥10 chars to enable Next), AI follow-up appearance, progress indicator (1/3 2/3 3/3), skip affordance (turns 2–3), save/saving state, session complete state
- [x] Resume/start-fresh prompt designed with copy ("Continue" / "Start fresh" on resume card)
- [x] Journal history screen spec'd: FlatList, flat card rows, empty state, v2 detail placeholder
- [x] Evening reminder settings designed: Switch toggle + conditional time row with LayoutAnimation, placement in Settings after "Reminders" section
- [x] User state profile view designed: introduction copy, elevated card with user_state.content or placeholder, "last updated" row, privacy note
- [x] All designs consistent with the Serene Interface aesthetic and existing design tokens
- [x] Accessibility notes included (contrast ratios, 44pt tap targets, accessibilityLabels, reduced-motion fallbacks)
- [x] Specs sufficient for @react-native-developer to implement without further UX clarification

## Files Created / Modified

| File | Action | Description |
|------|--------|-------------|
| `.assets/journal-ux-spec.md` | Created | Complete UX spec: all 5 screens, session state machine, component summary, motion summary, accessibility checklist, open questions |
| `docs/technical/ARCHITECTURE.md` | Modified | Added `### UX Spec (task #044, @ui-ux-designer)` sub-section under `## Journal Subsystem` with new/modified screens table and component change summary |
| `.tasks/044-journal-ux-design.md` | Modified | Marked complete, added file inventory |

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created |
| 2026-04-11 | @ui-ux-designer | Task completed — UX spec written, ARCHITECTURE.md updated |

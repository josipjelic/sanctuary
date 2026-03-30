---
id: "023"
title: "UX design: reminder indicators, approval sheet, notification settings"
status: "completed"
area: "design"
agent: "@ui-ux-designer"
priority: "high"
created_at: "2026-03-30"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: []
blocks: ["026"]
blocked_by: ["022"]
---

## Description

Design all user-facing surfaces for the AI Reminder Detection & Approval Workflow. This is a design-only task — no code is written here. Deliverables are specs and annotated assets consumed by @react-native-developer in task #026.

Surfaces to design:

1. **Bell icon on ThoughtListCard** — indicator shown when a thought has one or more pending (inactive) reminders awaiting user approval.
2. **Pending-reminders pill in Thoughts tab header** — badge or pill showing a count of total unapproved reminders across the inbox (e.g. "3 reminders to review").
3. **Reminder Approval Sheet** — bottom sheet modal surfaced from the Thoughts header pill or from tapping a bell-icon thought. Displays a list of pending reminders, each with: extracted text snippet, AI-suggested date/time (editable via DateTimePicker), and Approve / Dismiss actions.
4. **Notification Settings additions** — new fields in the existing Settings modal: lead-time selector (e.g. "remind me X minutes/hours before") and morning digest time picker.

All designs must conform to the existing Serene Interface design system (Sage `#536253`, Parchment `#f9f9f8`, Manrope + Plus Jakarta Sans, xl/lg radius, no border lines, ambient shadows only).

## Acceptance Criteria

- [ ] Bell icon spec: size, placement within ThoughtListCard, active vs inactive state, color.
- [ ] Pending-reminders pill spec: position in Thoughts header, count badge behavior (hidden when zero, shown when ≥1).
- [ ] Reminder Approval Sheet spec: full component layout, list item anatomy (extracted text, editable date/time, approve/dismiss controls), empty-state design.
- [ ] Settings additions spec: lead-time picker options and default, morning digest time picker layout.
- [ ] All specs reference existing design tokens from `src/lib/theme.ts` — no new tokens introduced without justification.
- [ ] Deliverables documented or linked in `.assets/` or a design annotation file for @react-native-developer.
- [ ] Relevant documentation updated.

## Technical Notes

- ThoughtListCard is implemented in `src/components/ThoughtListCard.tsx`. The bell icon should slot into the existing card layout without restructuring it.
- The Settings modal is currently a sheet opened from the gear icon on the Capture screen. Notification settings fields add to this existing sheet — no new navigation required.
- DateTimePicker: Expo ecosystem typically uses `@react-native-community/datetimepicker` (bundled with Expo). Design should account for iOS and Android native picker differences — spec both if they diverge meaningfully.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-30 | human | Task created |
| 2026-03-30 | @ui-ux-designer | Spec written to `.assets/reminders-ux-spec.md`; task completed |

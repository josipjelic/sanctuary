---
id: "028"
title: "Docs: USER_GUIDE.md reminders section"
status: "todo"
area: "docs"
agent: "@documentation-writer"
priority: "normal"
created_at: "2026-03-30"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: []
blocked_by: ["026", "027"]
---

## Description

Update `docs/user/USER_GUIDE.md` with a new section covering the AI Reminder Detection & Approval Workflow feature. The section should be written in the existing USER_GUIDE tone: calm, clear, non-technical, concise.

Content to cover:

- **What gets detected**: explain that Sanctuary automatically notices when a thought contains a future time reference ("call the dentist next Tuesday", "review this in 3 hours") and queues it as a reminder for the user to review.
- **How to review and approve reminders**: describe the pending-reminders pill in the Thoughts tab, how to open the Reminder Approval Sheet, how to edit the suggested date/time, and how to approve or dismiss each reminder.
- **Notification settings**: document the lead-time picker (how many minutes before the reminder fires) and the morning digest time picker; explain where these are found (Settings modal from the Capture screen).
- **What happens after approval**: clarify that approved reminders trigger a local device notification at the scheduled time; notifications must be permitted in device Settings for this to work.
- **Troubleshooting**: add entries to the existing troubleshooting table for: reminder not appearing (AI found no time reference), notification not firing (permission denied or app not installed), wrong time suggested (how to edit before approving).

## Acceptance Criteria

- [ ] `docs/user/USER_GUIDE.md` updated with a "Reminders" section (under Features, after "Library").
- [ ] Troubleshooting table updated with at least 3 new reminder-related rows.
- [ ] "Last updated" date at the top of USER_GUIDE.md updated.
- [ ] Language matches existing guide tone — no jargon, no internal task/ADR references visible to users.
- [ ] Relevant documentation updated.

## Technical Notes

- Read the implemented feature in #026 before writing — describe actual behavior, not design intent.
- Do not reference internal task numbers, ADR identifiers, or database table names in the user-facing guide.
- The guide currently ends the Features section with "Daily Check-in (coming in a future release)". Insert the Reminders section before that note, or after Library — whichever reads more naturally after reviewing the final feature.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-30 | human | Task created |

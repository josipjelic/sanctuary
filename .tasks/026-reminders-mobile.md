---
id: "026"
title: "Mobile: inbox indicators + reminder approval sheet + settings + push tokens"
status: "in_progress"
area: "mobile"
agent: "@react-native-developer"
priority: "high"
created_at: "2026-03-30"
due_date: null
started_at: "2026-03-30"
completed_at: null
prd_refs: []
blocks: ["028"]
blocked_by: ["023", "025"]
---

## Description

Implement all mobile-side surfaces for the AI Reminder Detection & Approval Workflow, following the specs delivered in #023 and wiring to the backend delivered in #025.

Work items:

1. **Pending-reminders pill in Thoughts (inbox) header** — fetch count of `inactive` reminders on focus; show a pill/badge when count ≥ 1; tap opens the Reminder Approval Sheet.

2. **Bell icon on ThoughtListCard** — show bell icon on cards that have ≥ 1 pending reminder; tap opens the Reminder Approval Sheet filtered to that thought's reminders.

3. **ReminderApprovalSheet modal** — bottom sheet listing pending reminders. Each item shows: extracted text snippet, AI-suggested datetime (editable via `@react-native-community/datetimepicker`), Approve button (calls approve endpoint then schedules local notification), Dismiss button (calls dismiss endpoint).

4. **Local notification scheduling** — on approval, call `Notifications.scheduleNotificationAsync()` with the confirmed `scheduled_at` minus lead-time preference. Use `expo-notifications`.

5. **Push token registration** — on app startup (authenticated), request notification permissions and register the Expo Push Token with the backend (or store locally per architecture decision in #022).

6. **Settings additions** — add lead-time picker (e.g. 5 / 15 / 30 / 60 minutes before) and morning digest time picker to the existing Settings modal. Persist choices via the `user_preferences` backend.

## Acceptance Criteria

- [ ] Pending-reminders pill appears in inbox header when `inactive` reminders exist; hidden when count is zero.
- [ ] Bell icon visible on ThoughtListCard rows with pending reminders; absent otherwise.
- [ ] ReminderApprovalSheet opens from both the header pill and the bell icon; shows correct reminders for context.
- [ ] DateTimePicker allows editing `scheduled_at` before approving; default is AI-suggested value.
- [ ] Approve action: calls backend approve endpoint, schedules local notification via `expo-notifications`, dismisses item from sheet.
- [ ] Dismiss action: calls backend dismiss endpoint, removes item from sheet.
- [ ] Empty state shown when all reminders in the sheet have been actioned.
- [ ] Notification permissions requested on first authenticated launch; graceful handling when denied.
- [ ] Settings modal shows lead-time picker and morning digest time picker; values saved to `user_preferences`.
- [ ] All new components follow Serene Interface design tokens (`src/lib/theme.ts`).
- [ ] Relevant tests written and passing.
- [ ] Relevant documentation updated.

## Technical Notes

- `expo-notifications` is the correct package for SDK 54 (managed workflow). Check whether it requires `expo-device` for permission gating on Android.
- `@react-native-community/datetimepicker` is the standard Expo-compatible date/time picker; it is likely already bundled — confirm in `package.json` before adding.
- Local notifications only (no APNs/FCM server-push in v1 unless #022 changes the strategy). `scheduleNotificationAsync` fires at the device-local time — ensure the datetime is converted from UTC `scheduled_at` to the device local timezone correctly.
- ReminderApprovalSheet should be a new component under `src/components/` or a screen-level modal in `src/app/(app)/inbox/`.
- Pull-to-refresh on the inbox should also refresh the pending-reminder count.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-30 | human | Task created |

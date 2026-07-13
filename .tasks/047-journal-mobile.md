---
id: "047"
title: "AI-guided journal: mobile screens"
status: "done"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-12"
completed_at: "2026-04-12"
prd_refs: ["FR-030", "FR-060", "FR-061", "FR-062", "FR-063", "FR-073"]
blocks: ["048", "049"]
blocked_by: ["044", "046"]
---

## Description

Implement all mobile screens, navigation, and device integrations for the AI-Guided Journal feature. Blocked by UX design (#044, for specs) and backend (#046, for edge function availability).

### Deliverables

1. **4th Journal tab** in the bottom nav (`src/app/(app)/journal/`). Tab icon and label per UX spec (#044).

2. **Journal conversation screen** (`journal/session.tsx`):
   - On mount: call `journal-next-question` to fetch the opening question.
   - Display question full-screen; user types answer in a text input below.
   - On submit: call `journal-next-question` with updated turns. Display follow-up question or session-complete state.
   - Enforce max 3 turns client-side as a UI guard (server also enforces).
   - "Finish session" button available at any turn — calls `journal-save-session` with `status: completed`.
   - Loading states between AI responses (skeleton or gentle animation, consistent with app aesthetic).
   - On error: non-disruptive toast; session answers preserved locally so the user doesn't lose work.

3. **Resume / start-fresh flow**:
   - On Journal tab focus: check for any `pending` session in `journal_sessions` for the current user (within 24h).
   - If found: show a resume card ("Continue" / "Start fresh").
   - Resume: reload the existing session and continue from the last answered turn.
   - Start fresh: mark old session `abandoned`, start new session.

4. **Journal history screen** (`journal/history.tsx`):
   - List of completed sessions, newest first.
   - Each row: date + first question as preview text.
   - Tap: disabled (session detail is v2); chevron shown at opacity 0.4.

5. **Evening reminder scheduling**:
   - In Settings screen: new "Journal" section with evening reminder toggle and time picker (default 21:00).
   - On toggle on / time change: schedule a recurring daily local notification via Expo Notifications.
   - On toggle off: cancel the scheduled notification.
   - Persist preference to `user_preferences` via Supabase.

6. **User state profile view** (`journal/profile.tsx`):
   - Read-only display of `user_state.content` text.
   - "Last updated" row with relative time.
   - Privacy note.
   - Pull-to-refresh.

## Acceptance Criteria

- [x] Journal tab appears as the 4th tab in the bottom navigation
- [x] Conversation screen: opening question loads, answers can be submitted, follow-up questions appear, session completes at turn 3 or when AI returns done
- [x] Resume card appears when pending session exists within 24h; both Continue and Start fresh paths work
- [x] Journal history screen lists completed sessions; empty state shown with CTA
- [x] Evening reminder toggle and time picker work; notification scheduled/cancelled correctly
- [x] User state profile view displays the analysis text or empty state
- [x] All screens follow design specs from task #044 (UX spec)
- [x] Loading states and error handling implemented for all API calls
- [x] TypeScript strict mode — no `any` types
- [x] pnpm run lint passes (Biome)
- [x] pnpm run typecheck passes

## Files Created

- `src/app/(app)/journal/_layout.tsx` — Stack navigator for journal group
- `src/app/(app)/journal/index.tsx` — Journal Home (State A / State B)
- `src/app/(app)/journal/session.tsx` — Journal Session (full-screen conversational screen)
- `src/app/(app)/journal/complete.tsx` — Session Complete
- `src/app/(app)/journal/history.tsx` — Past Entries (FlatList)
- `src/app/(app)/journal/profile.tsx` — User Journal Profile

## Files Modified

- `src/app/(app)/_layout.tsx` — Added 4th Journal tab (Ionicons book/book-outline)
- `src/app/(app)/index.tsx` — Added Journal settings section (evening reminder toggle, time row, profile row)
- `src/lib/notifications.ts` — Added `scheduleEveningJournalReminder`, `cancelEveningJournalReminder`, `rescheduleEveningJournalReminder`
- `supabase/functions/journal-save-session/index.ts` — Formatting fix (Biome)

## Technical Notes

- `accessibilityRole="article"` is not a valid React Native `AccessibilityRole` — removed from View elements (it's an HTML/ARIA concept). Used `accessibilityLabel` directly on containers instead.
- Session screen uses `useCallback`-memoized `fetchNextQuestion` and `displayQuestion`. Initial `useEffect` is mount-only with a biome-ignore comment.
- Evening reminder functions follow the same `SchedulableTriggerInputTypes.DAILY` pattern as `scheduleDailyMorningNotification`.
- Button component `style` prop is typed as `ViewStyle` (not `StyleProp<ViewStyle>`), so arrays are not accepted — each button gets its own style entry in the stylesheet.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created |
| 2026-04-12 | @react-native-developer | Implementation complete; lint and typecheck pass |

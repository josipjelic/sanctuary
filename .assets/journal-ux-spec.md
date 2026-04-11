# Journal UX Specification

> Feature: AI-Guided Journal — Session Flow, History, Profile, Evening Reminder
> Author: @ui-ux-designer
> Created: 2026-04-11
> For implementation by: @react-native-developer (task #047)
> Design system reference: `src/lib/theme.ts`, `.assets/DESIGN.md`
> ADR reference: ADR-006
> PRD refs: FR-030 (journaling), FR-060–063 (memory layer — pre-v2 variant), FR-073 (notifications)

---

## Design intent

**Design story**: "A daily return to yourself." The journal is not a productivity tool and must never feel like one. Each session is a quiet appointment — the user arrives, settles in, answers one question at a time, and leaves having made sense of something. The interface should evaporate: no chrome, no gamification, no progress bars that create anxiety. The experience is measured in turns (1–3), not minutes.

**Aesthetic stance**: The journal inherits the Serene Interface language but deepens it. Where the Quick Capture screen is a moment of offloading, the journal screen is a moment of receiving. The card holding the question should feel like a letter — elevated, worth reading slowly. The input below it is where the reply lives.

**Mood**: Still. Unhurried. Private.

---

## Persona grounding

**The Quiet Thinker** may not have journaled before. The opening question (`"Take a moment to settle in…"`) must reduce blank-page anxiety immediately. Three entry points (event, feeling, thought) in the opening question guarantee they always have somewhere to begin. The 10-character minimum before "Next" is lenient by design — a single sentence unlocks progress. Skip is available on questions 2 and 3, never question 1 (the anchor turn must be answered).

**The Reflective Journaler** will write paragraphs. The `TextInput` must be generous in height, the keyboard must not obscure the action area, and the progress indicator must not feel like a countdown. They will appreciate the "Save journal" label over "Submit" — it signals that this writing is for them, not the system.

---

## Design system quick-reference

All values drawn from `src/lib/theme.ts`. No new tokens are introduced by this feature.

| Token | Value | Notes |
|---|---|---|
| `colors.primary` | `#536253` | CTA backgrounds, progress indicator, active states |
| `colors.onPrimary` | `#ecfce8` | Text on sage buttons |
| `colors.primaryContainer` | `#d7e7d3` | Tinted fills, checkmark icon accent |
| `colors.onPrimaryContainer` | `#122612` | Labels on tinted fills |
| `colors.secondary` | `#576165` | Subtitles, hint text, metadata |
| `colors.secondaryContainer` | `#dae4e9` | Secondary button background |
| `colors.onSecondaryContainer` | `#121e22` | Text on secondary button |
| `colors.surface` | `#f9f9f8` | Screen background (Parchment) |
| `colors.surfaceContainerLowest` | `#ffffff` | Card backgrounds, sheet backgrounds |
| `colors.surfaceContainerLow` | `#f1f4f3` | Answer input background |
| `colors.surfaceContainerHigh` | `#e3e9e8` | Skeleton shimmer, separator, pressed states |
| `colors.surfaceContainerHighest` | `#dde3e2` | Inactive tab indicator |
| `colors.onSurface` | `#2c3433` | Primary body text, headlines |
| `colors.onSurfaceVariant` | `#3f4948` | Secondary body text |
| `colors.outline` | `#6f7978` | Ghost borders |
| `colors.outlineVariant` | `#abb4b3` | Turn labels, timestamps, dimmed metadata |
| `colors.error` | `#9e422c` | Error backgrounds (toast), error text |
| `colors.onError` | `#ffffff` | Text on error backgrounds |
| `typography.displayLg` | Manrope_700Bold, 56pt | Not used in this feature |
| `typography.headlineMd` | Manrope_600SemiBold, 28pt | Question text, screen titles, completion headline |
| `typography.bodyLg` | PlusJakartaSans_400Regular, 16pt | Body copy, answer input, card content |
| `typography.labelMd` | PlusJakartaSans_400Regular, 12pt | Turn labels, metadata, character count, hints |
| `spacing.s2` | 8pt | Tight gaps |
| `spacing.s4` | 16pt | Standard gap / padding |
| `spacing.s6` | 24pt | Card padding |
| `spacing.s8` | 32pt | Screen horizontal padding, card padding |
| `spacing.s12` | 48pt | Safe-area bottom buffer |
| `spacing.s16` | 64pt | Hero vertical breathing room |
| `spacing.s20` | 80pt | Top-of-screen hero spacing |
| `radius.sm` | 8pt | Small pills |
| `radius.md` | 16pt | Row-level elements, settings rows |
| `radius.lg` | 24pt | Session card, history card, input |
| `radius.xl` | 32pt | Resume card, profile card, toast |
| `radius.full` | 9999 | Buttons, pill chips |
| `shadows.card` | Y:8, Blur:32, onSurface 4% | Ambient elevation |
| `animation.driftDuration` | 500ms | Sheet slide-in |

---

## Navigation overview

```
(app)/_layout.tsx  ← tab navigator
  ├── Capture tab (index.tsx)          [existing]
  ├── Thoughts tab (inbox/)            [existing]
  ├── Library tab (library/)           [existing]
  └── Journal tab (journal/)           [NEW — 4th tab]
        ├── journal/index.tsx          ← Journal Home (State A or State B)
        │     ├── → journal/session.tsx          (Begin / Continue)
        │     └── → journal/history.tsx          ("Past entries" row)
        ├── journal/session.tsx        ← Journal Session (full-screen stack push)
        │     └── → journal/complete.tsx          (on successful save)
        ├── journal/complete.tsx       ← Session Complete
        │     ├── → journal/index.tsx             ("Back to journal" button / auto-redirect)
        │     └── → journal/profile.tsx           ("View your profile" button)
        ├── journal/history.tsx        ← Journal History (from "Past entries" row)
        └── journal/profile.tsx        ← Journal Profile (from Complete + Settings)
```

**Settings modal** (existing `src/app/(app)/index.tsx`): new "Journal" section with evening reminder toggle, time row, and "Your journal profile" row → `journal/profile.tsx`.

---

## Journal tab icon

**Tab**: 4th tab in the bottom nav alongside Capture, Thoughts, Library.

| State | Icon | Color |
|---|---|---|
| Idle | `Ionicons book-outline` | `colors.outlineVariant` |
| Active (focused) | `Ionicons book` (filled) | `colors.primary` |

**Label**: `"Journal"` — `typography.labelMd`, `colors.primary` when active, `colors.outlineVariant` when idle.

**Tab bar placement**: The tab appears to the right of Library. The tab navigator order is: Capture → Thoughts → Library → Journal.

**Accessibility**:
- `accessibilityRole="tab"`
- `accessibilityLabel="Journal tab"`
- `accessibilityState={{ selected: true/false }}`

---

## Screen 1 — Journal Home (`src/app/(app)/journal/index.tsx`)

### User goal

Arrive at a calm entry point that clearly offers one action (begin or resume a session) and a secondary path to history.

### Screen structure

The screen has two states based on `journal_sessions` query result. A `useFocusEffect` triggers the pending-session query every time the tab is focused (consistent with how the inbox refreshes on focus).

**Query on focus**: `SELECT * FROM journal_sessions WHERE user_id = auth.uid() AND status = 'pending' AND created_at > now() - interval '24 hours' ORDER BY created_at DESC LIMIT 1`

- If no row: **State A** — no incomplete session.
- If row exists: **State B** — incomplete session detected.

### Shared layout (both states)

**Background**: `colors.surface` (`#f9f9f8`) — full screen.

**Safe area**: `SafeAreaView` with `edges={["top", "bottom"]}`.

**Header row** (top of screen):
- Left: `"sanctuary"` wordmark in `typography.labelMd`, `colors.primary`, `letterSpacing: 4` — all lowercase, same as the Quick Capture header brand mark.
- Right: empty — no settings icon on this screen (settings remain in the Capture tab).
- `paddingHorizontal: spacing.s8`, `paddingTop: spacing.s4`, `flexDirection: "row"`, `justifyContent: "space-between"`, `alignItems: "center"`.

**"Past entries" row** (pinned to bottom of scroll content, above safe-area):
- A `Pressable` row: `paddingVertical: spacing.s4`, `paddingHorizontal: spacing.s8`.
- Label: `"Past entries"` — `PlusJakartaSans_600SemiBold`, 14pt, `colors.primary`.
- Right side: `Ionicons chevron-forward`, 18pt, `colors.primary`.
- `flexDirection: "row"`, `justifyContent: "space-between"`, `alignItems: "center"`.
- Pressed state: `colors.surfaceContainerHigh` background, `borderRadius: radius.md`.
- `minHeight: 44pt` touch target.
- On press: `router.push('/(app)/journal/history')`.
- `accessibilityRole="button"`, `accessibilityLabel="Past journal entries"`, `accessibilityHint="Shows your completed journal sessions"`.

---

### State A — No incomplete session

**Hero section** (between header and "Past entries" row):

```
[ paddingHorizontal: spacing.s8 ]

  marginTop: spacing.s20 (80pt)
  "Your daily reflection"
  typography.headlineMd, colors.onSurface

  marginTop: spacing.s4 (16pt)
  "A quiet space to make sense of your day."
  typography.bodyLg, colors.secondary

  marginTop: spacing.s16 (64pt)
  [ Button — "Begin today's journal" — primary — full width ]

```

**Hero headline**: `"Your daily reflection"` — `typography.headlineMd` (Manrope_600SemiBold, 28pt), `colors.onSurface`. Left-aligned.

**Hero subtitle**: `"A quiet space to make sense of your day."` — `typography.bodyLg` (Plus Jakarta Sans 16pt), `colors.secondary`, `lineHeight: 26`. Left-aligned. `marginTop: spacing.s4` below headline.

**Primary CTA**: `Button` component, `variant="primary"`, `label="Begin today's journal"`, full width (`width: "100%"`). `marginTop: spacing.s16` (64pt below subtitle — generous breathing room before the action). On press: create a new `journal_sessions` row (`status: 'pending'`) then `router.push('/(app)/journal/session', { params: { sessionId } })`.

**"Past entries" row**: below hero content, `marginTop: spacing.s8` (32pt).

**Behaviour flow**:

```
Step 1: Screen mounts → useFocusEffect queries pending sessions
Step 2: No pending session → State A renders
Step 3: User taps "Begin today's journal"
  → INSERT journal_sessions (status: 'pending', opening_question_version: 'v1')
  → INSERT journal_entries (turn_index: 0, question: JOURNAL_OPENING_QUESTION_V1, answer: NULL)
  → router.push to session screen with new sessionId
Step 4: Session screen opens (see Screen 2)
Edge case: INSERT fails (network) → show inline error below CTA:
  "Couldn't start your journal. Try again." — typography.labelMd, colors.error, marginTop: spacing.s2
  With "Try again" pressable (colors.primary) that re-attempts the insert.
```

**Accessibility**:
- Headline: `accessibilityRole="header"`.
- CTA: `accessibilityLabel="Begin today's journal session"`.

---

### State B — Incomplete session detected

**Resume card** (between header and "Past entries" row):

`marginTop: spacing.s8` (32pt from header), `marginHorizontal: spacing.s8` (32pt).

**Card container**: `Card` component, `variant="elevated"`, `size="xl"` (radius.xl = 32pt), `padding: spacing.s8` (32pt). Ambient shadow.

**Card content** (top to bottom):

1. **Date/time line**: formatted relative time — e.g. `"Started 3 hours ago"` or `"Started yesterday evening"` — `typography.labelMd`, `colors.outlineVariant`, `marginBottom: spacing.s4`.

2. **Opening answer preview**: first 100 characters of `journal_entries[turn_index=0].answer` (or the opening question text if the user hadn't yet answered turn 0), italic, truncated with `numberOfLines={2}`. `typography.bodyLg`, `colors.onSurfaceVariant`, `fontStyle: "italic"`. `marginBottom: spacing.s6`.

   If answer is NULL (session created but opening question not yet answered): show the opening question text instead, non-italic, `colors.outlineVariant`. Micro-label above: `"You were just getting started."` — `typography.labelMd`, `colors.outlineVariant`.

3. **Two-button row**: `flexDirection: "row"`, `gap: spacing.s4`, `marginTop: spacing.s2`.
   - **"Continue"** button: `Button`, `variant="primary"`, `flex: 1`. On press: `router.push('/(app)/journal/session', { params: { sessionId: pendingSession.id } })`.
   - **"Start fresh"** button: `Button`, `variant="secondary"`, `flex: 1`. On press: mark old session `abandoned` → insert new session → push to session screen (same flow as State A CTA, then navigate).

**"Start fresh" confirmation**: no confirmation dialog — "Start fresh" on a pending session is reversible enough (the old session's partial answers are not deleted, merely abandoned). Starting fresh is a low-stakes action; a dialog would be paternalistic.

**"Past entries" row**: below the resume card, `marginTop: spacing.s6` (24pt).

**Behaviour flow**:

```
Step 1: useFocusEffect finds pending session (within 24h) → State B
Step 2a: User taps "Continue"
  → Load existing journal_entries for session, ordered by turn_index
  → Resume from first entry where answer IS NULL
  → router.push session screen
Step 2b: User taps "Start fresh"
  → UPDATE journal_sessions SET status = 'abandoned' WHERE id = pendingSession.id
  → INSERT new journal_sessions row
  → INSERT journal_entries[turn_index=0] (opening question, answer: NULL)
  → router.push session screen with new sessionId
Step 3: Session proceeds normally (see Screen 2)
Edge case: UPDATE/INSERT fails → show error below card:
  "Something went wrong. Try again." — typography.labelMd, colors.error
```

**Accessibility**:
- Card: `accessibilityRole="article"`, `accessibilityLabel="Incomplete journal session, started [relative time]"`.
- Continue button: `accessibilityLabel="Continue your journal session"`.
- Start fresh button: `accessibilityLabel="Start a new journal session"`.

---

## Screen 2 — Journal Session (`src/app/(app)/journal/session.tsx`)

### User goal

Answer up to three reflective questions, one at a time, without feeling tested or rushed.

### Screen structure

This is a **full-screen stack push** — the tab bar is hidden. The screen owns the full viewport.

**Background**: `colors.surface` (`#f9f9f8`).

**Safe area**: `SafeAreaView`, `edges={["top", "bottom"]}`.

### Header row

`paddingHorizontal: spacing.s8`, `paddingTop: spacing.s4`, `flexDirection: "row"`, `alignItems: "center"`, `justifyContent: "space-between"`.

- **Left**: `Ionicons arrow-back`, 24pt, `colors.onSurfaceVariant`, wrapped in 44×44pt `Pressable` (`borderRadius: radius.full`, pressed state `colors.surfaceContainerHigh`). On press: prompt to confirm exit (see "Exit mid-session" below).
- **Center**: `"Journal"` — `typography.labelMd`, `colors.onSurface`, `letterSpacing: 0.5`. `accessibilityRole="header"`.
- **Right**: Progress indicator — `"1 / 3"` / `"2 / 3"` / `"3 / 3"` — `typography.labelMd`, `colors.outlineVariant`. Right-aligned. Human-readable, 1-indexed.

**Progress indicator accessibility**: `accessibilityLabel="Question {n} of 3"`.

### Session state machine

```
[session_init]
  ↓  sessionId received via route param; entries loaded
  
[question_1]  — turn_index 0, opening question (JOURNAL_OPENING_QUESTION_V1)
  → user types answer (≥10 chars) → "Next" enabled
  → user taps "Next"
    → UPDATE journal_entries[turn_index=0].answer + answered_at
  ↓

[loading_q2]  — POST /journal-next-question { session_id, turns: [turn0], user_state_snapshot? }
  → question card shows skeleton (see skeleton spec below)
  → "Next" button shows ActivityIndicator, disabled
  ↓
  ← response: { question, turn_index: 1 } OR { done: true }

[question_2]  — turn_index 1 (AI-generated follow-up) [OR jump to saving if done: true]
  → INSERT journal_entries[turn_index=1, question: <AI question>, answer: NULL]
  → user answers (≥10 chars OR skips) → "Next" enabled
  → user taps "Next" (or "Skip")
    → UPDATE journal_entries[turn_index=1].answer + answered_at (empty string if skipped)
  ↓

[loading_q3]  — POST /journal-next-question { session_id, turns: [turn0, turn1], user_state_snapshot? }
  → skeleton + disabled button
  ↓
  ← response: { question, turn_index: 2 } OR { done: true }

[question_3]  — turn_index 2 (AI-generated follow-up) [OR show "Save journal" if done: true at loading_q2/q3]
  → INSERT journal_entries[turn_index=2, question: <AI question>, answer: NULL]
  → "Save journal" button shown (replaces "Next")
  → user answers (or skips) → "Save journal" always enabled
  → user taps "Save journal"
    → UPDATE journal_entries[turn_index=2].answer + answered_at
  ↓

[saving]  — POST /journal-save-session { session_id }
  → button label → "Saving…" + ActivityIndicator
  → input locked (editable={false})
  ↓
  ← { session_id, saved_at }

[complete]  — router.replace('/(app)/journal/complete')
```

**`done: true` early completion**: If the AI returns `{ done: true }` at `loading_q2` (after turn 0) or `loading_q3` (after turn 1), the client skips the remaining question(s) and shows "Save journal" immediately. The progress indicator shows the last answered turn number (e.g. `"1 / 3"` if `done` after turn 0).

### Question card

**Scrollable content area**: A `ScrollView` (not FlatList) wrapping the question card + answer input. `showsVerticalScrollIndicator={false}`, `keyboardShouldPersistTaps="handled"`. `paddingHorizontal: spacing.s8`. `paddingBottom: spacing.s4` (the action area handles bottom space).

**Card container**: `Card` component, `variant="elevated"`, `size="lg"` (radius.lg = 24pt), `padding: spacing.s8` (32pt). Ambient shadow. `marginTop: spacing.s6` (24pt below header).

**Card contents** (top to bottom):

1. **Turn number label**: e.g. `"Question 1"` — `typography.labelMd`, `colors.outlineVariant`, `letterSpacing: 0.5`. `marginBottom: spacing.s4`.

2. **Question text**: `typography.headlineMd` (Manrope_600SemiBold, 28pt), `colors.onSurface`, `lineHeight: 36`. `marginBottom: spacing.s4`.

3. **Hint** (question 1 only): `"Take your time. Write as much or as little as feels right."` — `typography.labelMd`, `colors.secondary`. Shown only when `turnIndex === 0`. `marginTop: spacing.s2`.

**Opening question text** (constant `JOURNAL_OPENING_QUESTION_V1`):
> `"Take a moment to settle in. What's on your mind today — something that happened, a feeling, or just a thought that's been with you?"`

**Card entrance animation**: card slides in from the right on question advance (translateX: screenWidth → 0, 250ms, `cubic-bezier(0.4, 0, 0.2, 1)`). `prefers-reduced-motion` fallback: cross-fade, 150ms ease-in-out, no lateral movement.

**Card exit animation**: card slides out to the left (translateX: 0 → -screenWidth, 250ms, same easing), begins simultaneously with the incoming card's entrance. `prefers-reduced-motion`: cross-fade out simultaneously with cross-fade in.

### Skeleton loading state (question card)

Shown during `loading_q2` and `loading_q3` while awaiting the AI response.

The card renders its skeleton in place of the question text — the turn number label and hint are hidden during loading.

**Skeleton bar 1** (replaces question text, simulated first line):
- `width: "85%"`, `height: 20pt`, `borderRadius: radius.sm`, `backgroundColor: colors.surfaceContainerHigh`, `marginBottom: spacing.s2`.

**Skeleton bar 2** (simulated second line):
- `width: "60%"`, `height: 20pt`, `borderRadius: radius.sm`, `backgroundColor: colors.surfaceContainerHigh`.

**Shimmer animation**: `opacity` oscillates between `0.4` and `0.8`, 1200ms ease-in-out loop on both bars (offset bar 2 by 200ms for a natural stagger).

`prefers-reduced-motion` fallback: static bars at opacity `0.6`, no shimmer loop.

**Accessibility**: The card wrapper has `accessibilityLabel="Loading next question"`, `accessibilityLiveRegion="polite"` during the loading state. On question appear: announce `"Question {n} of 3: {question text}"` via an `aria-live="polite"` region.

### Answer input

Rendered below the question card, not inside it.

**Placement**: `marginTop: spacing.s6` (24pt below card), `marginHorizontal: 0` (uses the parent `ScrollView`'s `paddingHorizontal: spacing.s8`).

**Spec**:
- `TextInput` component (base), extended inline:
  - `multiline: true`
  - `minHeight: 120pt`
  - `maxHeight: 240pt` — scrolls within beyond this
  - Background: `colors.surfaceContainerLow` (`#f1f4f3`) — override the component's default `surfaceContainerHigh` via `style` prop
  - `borderRadius: radius.lg` (24pt) — override via `style` prop
  - `padding: spacing.s6` (24pt)
  - Font: `typography.bodyLg`, `colors.onSurface`
  - Placeholder: `"Your thoughts…"`, `colors.outlineVariant`
  - Focus ring: `colors.primary` at 20% opacity (existing component behaviour)
  - `returnKeyType: "default"` (multiline; let users use newlines naturally)
  - `blurOnSubmit: false`
  - Auto-focuses when a new question card renders: `inputRef.current?.focus()` called after 200ms delay post-transition to avoid keyboard pop during card slide

**Character count hint** (below input, shown when focused):
- `Text` element, `alignSelf: "flex-end"`, `marginTop: spacing.s2`, `marginRight: 0`
- Content: `"{n} characters"` — `typography.labelMd`, `colors.outlineVariant`
- Visible when input is focused or contains text
- Fades in at 150ms ease-out on focus gain; fades out when empty and blurred
- `prefers-reduced-motion`: instant show/hide
- `accessibilityElementsHidden={true}` — character count is supplementary; screen reader users do not need this announced

**Disabled state** (during `saving`): `editable={false}`, input `opacity: 0.6`.

### Action area (pinned to bottom)

Fixed above the keyboard, outside the `ScrollView`. Uses `KeyboardAvoidingView` wrapping the action area so it rises with the keyboard.

`paddingHorizontal: spacing.s8`, `paddingBottom: spacing.s12` (48pt — safe area), `paddingTop: spacing.s4`, `backgroundColor: colors.surface`.

**For questions 1–2 (not the final turn)**:
- `Button`, `variant="primary"`, `label="Next"`, full width (`width: "100%"`).
- **Disabled** when `answer.trim().length < 10`. Disabled state: `opacity: 0.4` (existing Button behaviour).
- **Loading state** (during AI fetch): label replaced by `ActivityIndicator` (white, size `"small"`), button disabled.

**For question 3 (final turn) OR when AI returns `done`**:
- `Button`, `variant="primary"`, `label="Save journal"`, full width.
- **Always enabled** (even if answer is empty — skipping all of Q3 is valid).
- **Saving state**: label changes to `"Saving…"` + `ActivityIndicator` inline (white, `size="small"`, `marginRight: spacing.s2`), button disabled.

**"Skip this question" affordance** (questions 2 and 3 only — NOT question 1):
- Rendered as a `Pressable` text link below the main button.
- `marginTop: spacing.s4` (16pt below button).
- Label: `"Skip this question"` — `PlusJakartaSans_600SemiBold`, 14pt, `colors.primary`, `textAlign: "center"`.
- `paddingVertical: spacing.s4` (16pt — touch target height ≥ 44pt achieved via this vertical padding + text height).
- On press: sets answer to empty string (`""`), submits, then proceeds to loading/save state.
- Hidden during loading and saving states.
- `accessibilityRole="button"`, `accessibilityLabel="Skip this question"`.

### Error states

**AI fetch error** (failed POST to `/journal-next-question`):
- Inline, below the skeleton card.
- `marginTop: spacing.s4`, `marginHorizontal: spacing.s8`.
- Copy: `"Couldn't load the next question."` — `typography.bodyLg`, `colors.onSurfaceVariant`.
- Beneath copy: `"Try again"` `Pressable` text link — `PlusJakartaSans_600SemiBold`, 14pt, `colors.primary`, `paddingVertical: spacing.s4`, `marginTop: spacing.s2`.
- `accessibilityRole="alert"` on the error container (announces immediately to screen readers).
- On "Try again" press: re-POST the same request; skeleton re-appears.

**Save error** (failed POST to `/journal-save-session`):
- Rendered as a bottom toast (snackbar-style), not a modal.
- Position: `position: "absolute"`, `bottom: spacing.s20` (80pt — above action area), `left: spacing.s8`, `right: spacing.s8`.
- Background: `colors.error` (`#9e422c`), text `colors.onError` (`#ffffff`), `borderRadius: radius.xl` (32pt), `padding: spacing.s4` (16pt).
- Copy: `"Couldn't save your journal. Try again."` — `typography.bodyLg`, `colors.onError`.
- Auto-dismisses after 4 seconds.
- `role="alert"` so screen readers announce immediately.
- After auto-dismiss, button re-enables to allow retry.

### Exit mid-session (back arrow tap)

When the user taps the back arrow during an active session (any turn):

- Show an **inline confirmation sheet** (bottom sheet `Modal`, not a full-screen overlay).
- Sheet background: `colors.surfaceContainerLowest`, `borderTopLeftRadius: radius.xl`, `borderTopRightRadius: radius.xl`, `padding: spacing.s8`, `paddingBottom: spacing.s12`.
- Headline: `"Leave your journal?"` — `typography.headlineMd`, `colors.onSurface`, `marginBottom: spacing.s4`.
- Body: `"Your answers so far are saved. You can continue later."` — `typography.bodyLg`, `colors.secondary`, `marginBottom: spacing.s8`.
- Two buttons stacked (full width):
  - `"Keep writing"` — `Button`, `variant="primary"`. Closes sheet, stays in session.
  - `"Leave for now"` — `Button`, `variant="secondary"`, `marginTop: spacing.s4`. Closes sheet + `router.back()` to journal home.
- No "discard" option — incremental persistence means the session is always recoverable. The user navigates back to State B on next Journal tab open.
- `accessibilityViewIsModal={true}`, `role="dialog"`, `aria-modal="true"`.
- Focus trap: focus moves to sheet headline on open; returns to back arrow on close.

### Accessibility

- All interactive elements: `minHeight: 44pt`, `minWidth: 44pt`.
- Question card: `accessibilityRole="article"`.
- Answer input: `accessibilityLabel` set to the current question text (not placeholder).
- `accessibilityHint="Your answer is private"` on the input.
- Action button: `accessibilityLabel="Next question"` for "Next"; `"Save journal session"` for "Save journal"; `"Saving your journal"` during saving.
- Progress indicator: `accessibilityLabel="Question {n} of 3"`, `accessibilityElementsHidden={false}` — announced so screen readers know where they are.
- Back arrow: `accessibilityLabel="Back — leave journal session"`.

---

## Screen 3 — Journal Session Complete (`src/app/(app)/journal/complete.tsx`)

### User goal

Feel a sense of quiet accomplishment. Know the session is saved. Have clear paths forward.

### Visual layout

**Background**: `colors.surface` (`#f9f9f8`). Full screen. `SafeAreaView`, `edges={["top","bottom"]}`.

**Layout**: `flex: 1`, `justifyContent: "center"`, `paddingHorizontal: spacing.s8`, `alignItems: "center"`.

**Content stack** (vertically centered):

1. **Checkmark icon**:
   - `Ionicons checkmark-circle-outline`, 64pt, `colors.primary`.
   - `marginBottom: spacing.s8` (32pt).
   - Entrance animation: scale from `0.7` to `1.0`, 400ms, `animation.springConfig` (damping 20, stiffness 100). `prefers-reduced-motion`: instant appear at full scale.

2. **Headline**: `"Reflection saved."` — `typography.headlineMd` (Manrope_600SemiBold, 28pt), `colors.onSurface`, `textAlign: "center"`. `marginBottom: spacing.s4`.

3. **Subtitle**: `"Well done for taking the time."` — `typography.bodyLg`, `colors.secondary`, `textAlign: "center"`, `lineHeight: 26`. `marginBottom: spacing.s12` (48pt).

4. **Buttons** (stacked, full width):
   - `"Back to journal"` — `Button`, `variant="primary"`, full width. On press: `router.replace('/(app)/journal')`.
   - `"View your profile"` — `Button`, `variant="secondary"`, full width. `marginTop: spacing.s4`. On press: `router.push('/(app)/journal/profile')`.

5. **Auto-redirect micro-copy** (below buttons):
   - `"Returning to journal in {n}s…"` — `typography.labelMd`, `colors.outlineVariant`, `textAlign: "center"`, `marginTop: spacing.s6`.
   - Countdown from 5 to 0. On reaching 0: `router.replace('/(app)/journal')`.
   - Tapping "Back to journal" or "View your profile" cancels the countdown.
   - `accessibilityLiveRegion="polite"` to announce countdown changes (not too aggressively — update every second is fine since this is polite).

### Accessibility

- Checkmark icon: `accessibilityElementsHidden={true}` (decorative).
- Headline: `accessibilityRole="header"`.
- On screen mount: announce `"Journal session saved"` via a brief `accessibilityLiveRegion="assertive"` flash on an invisible element — ensures screen readers know the save succeeded even if they haven't navigated to the headline yet.

---

## Screen 4 — Journal History (`src/app/(app)/journal/history.tsx`)

### User goal

Browse past sessions to remember what was written, track consistency, and feel a sense of accumulation.

### Visual layout

**Background**: `colors.surface`. `SafeAreaView`, `edges={["top","bottom"]}`.

**Header row**:
- Left: `Ionicons arrow-back`, 24pt, `colors.onSurfaceVariant`, 44×44pt `Pressable`. On press: `router.back()`.
- Center: `"Past entries"` — `typography.headlineMd`, `colors.onSurface`. `accessibilityRole="header"`.
- Right: empty.
- `paddingHorizontal: spacing.s8`, `paddingTop: spacing.s4`.

**Content**: `FlatList` of session cards, newest first (`ORDER BY created_at DESC`).

**Query**: `SELECT journal_sessions.id, journal_sessions.created_at, journal_sessions.status, journal_entries.answer, (SELECT COUNT(*) FROM journal_entries je WHERE je.session_id = journal_sessions.id AND je.answer IS NOT NULL AND je.answer != '') AS answered_count FROM journal_sessions LEFT JOIN journal_entries ON journal_entries.session_id = journal_sessions.id AND journal_entries.turn_index = 0 WHERE journal_sessions.user_id = auth.uid() AND journal_sessions.status = 'completed' ORDER BY journal_sessions.created_at DESC`.

`FlatList` props: `contentContainerStyle={{ paddingHorizontal: spacing.s8, paddingTop: spacing.s6, paddingBottom: spacing.s12 }}`, `ItemSeparatorComponent` renders a `spacing.s4` gap, `showsVerticalScrollIndicator={false}`.

### Session card

**Container**: `Card` component, `variant="flat"` (no shadow), `size="lg"` (radius.lg = 24pt), background `colors.surfaceContainerLow`. `paddingHorizontal: spacing.s6`, `paddingVertical: spacing.s6`.

**Card contents** (top to bottom):

1. **Date row**: formatted date (e.g. `"Wednesday, 9 April"`) — `typography.labelMd`, `colors.outlineVariant`, `letterSpacing: 0.5`. `marginBottom: spacing.s4`.

2. **Opening answer preview**: first 100 characters of `journal_entries[turn_index=0].answer`, truncated with `numberOfLines={2}`, `ellipsizeMode="tail"`. `typography.bodyLg`, `colors.onSurface`, `lineHeight: 26`. `marginBottom: spacing.s4`.

3. **Footer row**: `flexDirection: "row"`, `justifyContent: "space-between"`, `alignItems: "center"`.
   - Left: `"{answered_count} question{answered_count !== 1 ? 's' : ''} answered"` — `typography.labelMd`, `colors.outlineVariant`. Renders as a small chip: background `colors.surfaceContainerHigh`, `borderRadius: radius.full`, `paddingVertical: 4pt`, `paddingHorizontal: spacing.s2`.
   - Right: `Ionicons arrow-forward`, 16pt, `colors.outlineVariant`. **Note**: v1 tapping a history card does not navigate to a detail view (session detail is v2). The arrow is present as a forward-looking affordance but the card is currently non-pressable (no `onPress` handler). If a future detail screen is added, make the whole card `Pressable`. For now, render the arrow with `opacity: 0.4` to signal it is not yet active.

**Empty state**: shown when no `completed` sessions exist.

```
[Empty state — rendered as FlatList ListEmptyComponent]

  marginTop: spacing.s20 (80pt)
  Ionicons book-outline, 48pt, colors.outlineVariant
  → accessibilityElementsHidden={true}

  marginTop: spacing.s6
  "No journal entries yet."
  typography.headlineMd, colors.onSurface, textAlign: "center"
  accessibilityRole="header"

  marginTop: spacing.s4
  "Your first session will appear here."
  typography.bodyLg, colors.secondary, textAlign: "center"

  marginTop: spacing.s8
  Button, variant="secondary", label="Begin your first journal"
  width: "80%", alignSelf: "center"
  onPress: router.push('/(app)/journal')
```

### Accessibility

- `FlatList`: `accessibilityRole="list"`.
- Each session card: `accessibilityRole="article"`, `accessibilityLabel="Journal entry, {formatted date}, {answered_count} questions answered. Preview: {first 60 chars of opening answer}"`.
- Empty state: `accessibilityRole="alert"` on the container (announced when mounted into an empty list).

---

## Screen 5 — Journal Profile (`src/app/(app)/journal/profile.tsx`)

### User goal

Understand what Sanctuary has learned from journal sessions. Feel informed and in control. Know this data is private.

### Access paths

1. Tapping `"View your profile"` button on the Session Complete screen.
2. Tapping `"Your journal profile"` row in the Settings modal (see Settings additions below).

### Visual layout

**Background**: `colors.surface`. `SafeAreaView`, `edges={["top","bottom"]}`.

**Header row**:
- Left: `Ionicons arrow-back`, 24pt, `colors.onSurfaceVariant`, 44×44pt `Pressable`. On press: `router.back()`.
- Center: `"Your profile"` — `typography.headlineMd`, `colors.onSurface`. `accessibilityRole="header"`.
- Right: empty.
- `paddingHorizontal: spacing.s8`, `paddingTop: spacing.s4`.

**Content** (scrollable `ScrollView`, `paddingHorizontal: spacing.s8`, `paddingTop: spacing.s6`, `paddingBottom: spacing.s12`):

1. **Introduction text**:
   `"This is what Sanctuary has learned about you from your journal sessions. It helps personalise the questions you're asked."` — `typography.bodyLg` (16pt), `colors.secondary`, `lineHeight: 26`. Full width. `marginBottom: spacing.s6` (24pt).

2. **Profile content card**: `Card` component, `variant="elevated"`, `size="xl"` (radius.xl = 32pt), `padding: spacing.s8` (32pt). Full width. Ambient shadow.

   **If `user_state` row exists** (content available):
   - `user_state.content` text — `typography.bodyLg`, `colors.onSurface`, `lineHeight: 26`. Natural wrap. No character limit shown (full ~200-word profile is readable without truncation — it's the right length for this view).

   **If no `user_state` row** (first-time user / no sessions):
   - `"Complete your first journal session to start building your profile."` — `typography.bodyLg`, `colors.secondary`, `textAlign: "center"`, `fontStyle: "italic"`. Vertically centered within the card (`minHeight: 120pt`, `justifyContent: "center"`, `alignItems: "center"`).

3. **"Last updated" row** (`marginTop: spacing.s4`):
   - Only shown when `user_state` exists.
   - `"Updated {relativeTime}"` (e.g. `"Updated 2 days ago"`, `"Updated just now"`) — `typography.labelMd`, `colors.outlineVariant`.

4. **Privacy note** (`marginTop: spacing.s6`):
   `"This profile is private and only used to personalise your journal experience."` — `typography.labelMd`, `colors.outlineVariant`, `fontStyle: "italic"`. Full width.

### Accessibility

- Introduction text: `accessibilityRole="text"`.
- Profile card: `accessibilityRole="article"`, `accessibilityLabel="Your journal profile"`.
- Profile content text: `accessibilityRole="text"` — the AI-generated content is announced naturally by screen readers as body text. No special role needed.
- Privacy note: `accessibilityRole="text"`.

---

## Settings additions (existing Settings Modal in `src/app/(app)/index.tsx`)

### Placement

A new **"Journal"** section is inserted **after** the existing `"Reminders"` section and **before** the `"Sign out"` hint text.

### Section separator

A `View` with `height: 1pt`, `backgroundColor: colors.surfaceContainerHigh`, `marginVertical: spacing.s2` — same subtle hairline separator pattern as the "Reminders" section separator.

### Section label

`"Journal"` — `typography.labelMd` (12pt), `colors.outlineVariant`, `letterSpacing: 0.5`, `paddingTop: spacing.s4`. `accessibilityRole="header"`.

### Evening reminder toggle row

**Purpose**: Enable/disable the daily evening notification to journal.

**Layout**: `flexDirection: "row"`, `justifyContent: "space-between"`, `alignItems: "center"`, `paddingVertical: spacing.s4`, `paddingHorizontal: spacing.s2`, `minHeight: 44pt`.

**Left block**:
- Label: `"Evening reminder"` — `PlusJakartaSans_600SemiBold`, 16pt, `colors.onSurface`.
- Hint: `"Daily nudge to reflect on your day"` — `typography.labelMd`, 13pt, `colors.secondary`. Below the label.

**Right block**:
- `Switch` component (React Native built-in).
- `thumbColor`: `colors.surfaceContainerLowest` (white) on both states.
- `trackColor={{ false: colors.surfaceContainerHigh, true: colors.primary }}` — inactive grey, active sage.
- `value`: `eveningReminderEnabled` state (from `user_preferences` key `evening_notification_id` — non-null = enabled).
- On `onValueChange(true)`: schedule evening notification via `scheduleEveningReminder(hour, minute)` using current `evening_notification_time` preference (or default `21:00`); persist `evening_notification_id` to `user_preferences`.
- On `onValueChange(false)`: cancel scheduled notification; clear `evening_notification_id` from `user_preferences`.

**Accessibility**:
- `accessibilityRole="switch"`.
- `accessibilityLabel="Evening reminder"`.
- `accessibilityHint="Toggles a daily notification at your chosen time to remind you to journal"`.
- `accessibilityState={{ checked: eveningReminderEnabled }}`.

### Evening time row (conditional)

**Shown only when**: `eveningReminderEnabled === true`.

**Placement**: Immediately below the toggle row.

**Animated show/hide**: `LayoutAnimation.easeInEaseOut()` with 300ms duration triggered before the state update. `prefers-reduced-motion` fallback: instant show/hide (check `AccessibilityInfo.isReduceMotionEnabled()` before calling `LayoutAnimation`).

**Layout**: Matches the `settingsLanguageRow` pattern exactly — same as the existing reminder lead-time row in the "Reminders" section.

**Left block**:
- Label: `"Reminder time"` — `PlusJakartaSans_600SemiBold`, 16pt, `colors.onSurface`.
- Hint: `"When you receive your evening reminder"` — `typography.labelMd`, 13pt, `colors.secondary`. Below the label.

**Right block**:
- Formatted time, e.g. `"9:00 PM"` (locale-aware 12/24h format) — `typography.bodyLg`, `colors.secondary`.
- `Ionicons chevron-forward`, 20pt, `colors.secondary`.

**Default value**: `21:00` (stored as `"21:00"` in `user_preferences` under key `evening_notification_time`).

**On tap**: opens the native time picker.

- **iOS**: A `Modal` bottom sheet (same style as the Settings sheet itself — `surfaceContainerLowest`, `radius.xl` top corners, `spacing.s8` padding) containing a `DateTimePicker` in `display="spinner"` mode, `mode="time"`. Confirm + Cancel buttons. On confirm: update `user_preferences.evening_notification_time`, cancel existing notification identifier, reschedule with new time, persist new `evening_notification_id`.
- **Android**: Native system time picker dialog (default DateTimePicker behaviour). Same update logic on confirm.

Both platforms: locale-aware 12/24h display (DateTimePicker respects device locale automatically).

**Accessibility**:
- `accessibilityRole="button"`.
- `accessibilityLabel="Reminder time: {formatted time}. Tap to change."`.
- `accessibilityHint="Opens a time picker"`.

### "Your journal profile" row

**Layout**: `Pressable` row, same layout as the lead-time and language rows.

**Left**: `"Your journal profile"` — `PlusJakartaSans_600SemiBold`, 16pt, `colors.onSurface`.

**Right**: `Ionicons chevron-forward`, 20pt, `colors.secondary`.

`minHeight: 44pt`, `paddingVertical: spacing.s4`, `paddingHorizontal: spacing.s2`.

Pressed state: `colors.surfaceContainerHigh` background, `borderRadius: radius.md`.

On press: close Settings modal + `router.push('/(app)/journal/profile')`.

**Accessibility**:
- `accessibilityRole="button"`.
- `accessibilityLabel="Your journal profile"`.
- `accessibilityHint="Shows what Sanctuary has learned from your journal sessions"`.

---

## Component summary for @react-native-developer

### New screens

| Screen | File | Description |
|---|---|---|
| Journal Home | `src/app/(app)/journal/index.tsx` | Two states: no session (hero + CTA) and incomplete session (resume card). `useFocusEffect` query. |
| Journal Session | `src/app/(app)/journal/session.tsx` | Full-screen stack. Question card, skeleton loading, answer input, action area pinned to bottom. State machine: question_1 → loading → question_2 → loading → question_3 → saving → complete. |
| Journal Complete | `src/app/(app)/journal/complete.tsx` | Checkmark, headline, two buttons, 5-second auto-redirect. |
| Journal History | `src/app/(app)/journal/history.tsx` | FlatList of completed sessions, flat card rows, empty state. |
| Journal Profile | `src/app/(app)/journal/profile.tsx` | user_state.content display, last updated row, privacy note. |

### New tab registration

`src/app/(app)/journal/` must be registered as a 4th tab in `src/app/(app)/_layout.tsx` with:
- `tabBarIcon`: `Ionicons book-outline` (idle) / `book` (active)
- `tabBarLabel`: `"Journal"`

### Modified files

| File | Change |
|---|---|
| `src/app/(app)/_layout.tsx` | Add Journal tab (4th position) |
| `src/app/(app)/index.tsx` (Settings modal) | Add "Journal" section: evening reminder toggle, time row (conditional), profile row |
| `src/lib/notifications.ts` | Add `scheduleEveningReminder(hour, minute)` and `cancelEveningReminder()` functions following the ADR-005 morning notification pattern |

### Existing components used (no changes needed)

| Component | Usage |
|---|---|
| `Button` | `variant="primary"` for CTAs; `variant="secondary"` for secondary actions throughout all screens |
| `Card` | `variant="elevated"` + `size="xl"` for resume card and profile card; `variant="elevated"` + `size="lg"` for question card; `variant="flat"` + `size="lg"` for history cards |
| `TextInput` | Base component extended with `multiline`, `minHeight`, `maxHeight`, background override via `style` prop |

### Props and style overrides for TextInput (answer input)

```
<TextInput
  multiline
  style={{
    minHeight: 120,
    maxHeight: 240,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.s6,
  }}
  placeholder="Your thoughts…"
  accessibilityLabel={currentQuestion}
  accessibilityHint="Your answer is private"
  ref={inputRef}
  value={answer}
  onChangeText={setAnswer}
  editable={!isSaving}
/>
```

---

## Motion summary

| Animation | Duration | Easing | Reduced-motion fallback |
|---|---|---|---|
| Question card slide-in (enter) | 250ms | cubic-bezier(0.4, 0, 0.2, 1) | Cross-fade 150ms |
| Question card slide-out (exit) | 250ms | cubic-bezier(0.4, 0, 0.2, 1) | Cross-fade 150ms |
| Skeleton shimmer opacity loop | 1200ms/cycle | ease-in-out | Static opacity 0.6 |
| Checkmark entrance (complete screen) | 400ms | `animation.springConfig` | Instant appear |
| Resume card entrance (State B) | Native render | — | — |
| Exit confirmation sheet slide-in | Native Modal slide (~300ms) | Native | Static appear |
| Evening time row show/hide | 300ms `LayoutAnimation` | ease-in-out | Instant |
| Auto-redirect (complete screen) | N/A — countdown timer | — | — |
| Character count hint fade | 150ms | ease-out | Instant |

All non-essential animations must be guarded by `AccessibilityInfo.isReduceMotionEnabled()` (or the `useReducedMotion` hook pattern) before triggering.

---

## Accessibility checklist

- [ ] All interactive elements have `minHeight: 44pt` and `minWidth: 44pt`.
- [ ] All interactive elements have `accessibilityRole` and `accessibilityLabel`.
- [ ] `accessibilityHint` provided wherever the action is non-obvious.
- [ ] Colour is never the only status indicator (e.g. skeleton loading also has an `accessibilityLiveRegion` announcement; button disabled state uses `opacity` change AND `accessibilityState={{ disabled }}`).
- [ ] Contrast ratios: all text on surface variants is `colors.onSurface` (#2c3433) on `colors.surfaceContainerLowest` (#ffffff) = approx 12:1 ✓. `colors.secondary` (#576165) on `colors.surface` (#f9f9f8) = approx 4.8:1 ✓. Error toast: `colors.onError` (#ffffff) on `colors.error` (#9e422c) = approx 4.6:1 ✓.
- [ ] Focus management: exit confirmation modal traps focus; focus returns to back arrow on modal close.
- [ ] Keyboard navigation: all screens navigable via hardware keyboard (external keyboard on iPad). Tab order matches visual top-to-bottom, left-to-right layout.
- [ ] AI-generated content (question text, user_state.content): no special ARIA role needed — renders as `Text` and is announced as body text. Ensures screen reader users receive AI content naturally in reading flow.
- [ ] `accessibilityElementsHidden={true}` on all decorative icons (checkmark on complete screen, book icon in empty state, skeleton shimmer bars).
- [ ] `accessibilityRole="header"` on all screen titles and section headings.
- [ ] Evening reminder Switch: `accessibilityState={{ checked }}` reflects current toggle state to screen readers.
- [ ] `prefers-reduced-motion` handled for all animations (see Motion summary above).

---

## Open questions for @react-native-developer

1. **Session route params**: This spec assumes the `sessionId` (UUID) is passed to `session.tsx` via Expo Router route params (`router.push('/(app)/journal/session', { params: { sessionId } })`). Confirm that UUID strings in Expo Router v6 params do not cause issues on Android deep-link routing.

2. **`user_state` load timing on Profile screen**: The profile screen calls `SELECT * FROM user_state WHERE user_id = auth.uid()`. If the fire-and-forget update from the most recent `journal-save-session` is still in progress, the user may see a slightly stale `content` value. This is expected and acceptable — include a pull-to-refresh on the profile screen for users who want the latest.

3. **`KeyboardAvoidingView` strategy on session screen**: On Android, `behavior="height"` may be required instead of `behavior="padding"` for reliable action-area floating above the keyboard. Test both platforms; Android first since the keyboard behaviour is typically more complex.

4. **Notification permission timing**: The evening reminder toggle is the first place in the Settings modal that schedules a notification for journal purposes. If notification permission has not yet been granted (i.e., the user denied or dismissed the initial reminders permission prompt), call `Notifications.requestPermissionsAsync()` before calling `scheduleEveningReminder()`. If permission is denied, revert the toggle to off and show a toast: `"Notification permission required. Enable in Settings."`. Do not silently fail — the user expects the toggle to mean something.

5. **Resuming mid-session**: When the session screen receives an existing `sessionId`, it must load all existing `journal_entries` for that session, determine the first `NULL`-answer entry, and render that question. The AI question texts for turns 1 and 2 are stored in `journal_entries.question` (written by the client when the entry is created) — they do not need to be re-fetched from the AI.

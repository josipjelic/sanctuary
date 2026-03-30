# Reminders UX Spec

> Feature: AI Reminder Detection & Approval Workflow
> Author: @ui-ux-designer
> Created: 2026-03-30
> For implementation by: @react-native-developer (task #026)
> Design system reference: `src/lib/theme.ts`, `.assets/DESIGN.md`

---

## Persona grounding

Both personas benefit from this feature but in different ways.

**The Quiet Thinker** captures a thought like "call the dentist next Tuesday" mid-flow and wants it surfaced as a reminder without any extra steps. The key design principle here is that the approval interaction must feel like a single calm moment, not a task manager. Zero setup friction — they should be able to approve the AI's suggestion in two taps.

**The Reflective Journaler** will appreciate being able to review and refine the suggested time before confirming. They care about the "extracted text snippet" — it anchors the reminder to meaning, not just a raw timestamp.

### User goals driving each surface

- **Bell icon**: Signal at a glance that a thought contains a detectable time-reference, without interrupting the inbox browsing flow.
- **Pending-reminders pill**: Give the user a single, unobtrusive prompt to review accumulated reminders when they are ready — not via an interruptive notification.
- **Approval Sheet**: Let the user decide — approve, adjust, or dismiss — in a single focused session. Batch workflow, not per-thought interruptions.
- **Settings additions**: Let the user tune how reminders surface, once, and forget about it.

---

## Design system quick-reference

All values below are drawn from `src/lib/theme.ts`. No new tokens are introduced in this spec.

| Token | Value | Notes |
|---|---|---|
| `colors.primary` | `#536253` | Sage — grounding actions, selected states |
| `colors.onPrimary` | `#ecfce8` | Text on Sage backgrounds |
| `colors.primaryContainer` | `#d7e7d3` | Tinted badge fills |
| `colors.onPrimaryContainer` | `#122612` | Text on tinted fills |
| `colors.secondary` | `#576165` | Metadata, secondary labels |
| `colors.secondaryContainer` | `#dae4e9` | Secondary action fill |
| `colors.onSecondaryContainer` | `#121e22` | Text on secondary fill |
| `colors.surface` | `#f9f9f8` | App background (Parchment) |
| `colors.surfaceContainerLowest` | `#ffffff` | Sheet / elevated card background |
| `colors.surfaceContainerLow` | `#f1f4f3` | Section-level background |
| `colors.surfaceContainerHigh` | `#e3e9e8` | Pressed states, input backgrounds |
| `colors.surfaceContainerHighest` | `#dde3e2` | Hover/active backgrounds |
| `colors.onSurface` | `#2c3433` | Primary body text |
| `colors.onSurfaceVariant` | `#3f4948` | Secondary body text |
| `colors.outline` | `#6f7978` | Ghost borders, outlines |
| `colors.outlineVariant` | `#abb4b3` | Timestamps, dim metadata |
| `colors.error` | `#9e422c` | Dismiss / destructive tint |
| `typography.headlineMd` | Manrope_600SemiBold, 28pt | Sheet titles |
| `typography.bodyLg` | PlusJakartaSans_400Regular, 16pt | Body copy — minimum on mobile |
| `typography.labelMd` | PlusJakartaSans_400Regular, 12pt | Chips, metadata |
| `spacing.s2` | 8pt | Tight gaps |
| `spacing.s4` | 16pt | Standard gap / padding |
| `spacing.s6` | 24pt | Card padding |
| `spacing.s8` | 32pt | Sheet outer padding |
| `spacing.s12` | 48pt | Sheet bottom padding (safe area) |
| `radius.sm` | 8pt | |
| `radius.md` | 16pt | Row-level elements |
| `radius.lg` | 24pt | Card corners |
| `radius.xl` | 32pt | Sheet top corners |
| `radius.full` | 9999 | Pills, circular elements |
| `shadows.card` | Y:8 Blur:32 onSurface 4% opacity | Ambient elevation |
| `animation.driftDuration` | 500ms | Sheet slide-in |

---

## 1. Bell Icon (ThoughtListCard)

### Visual spec

The bell icon is an additive indicator slotted into the existing `ThoughtListCard` layout. It appears in the trailing (right) edge of the timestamp row — the bottom row of the card — positioned to the right of the relative timestamp text.

**Icon**: `Ionicons` — `notifications-outline` when pending (awaiting approval), `notifications` (filled) when the reminder is approved and scheduled. Use `notifications-off-outline` to signal a dismissed reminder is not shown (dismissed reminders do not show the icon at all — icon only appears for pending and approved states).

**Sizing**:
- Icon size: 16pt (fits comfortably beside `typography.labelMd` timestamp text without increasing row height)
- Touch target: the bell icon itself is not independently tappable — it is a passive indicator only. Tapping the card navigates to the thought detail as normal. The bell presence is a visual cue prompting the user to open the Approval Sheet via the header pill. This avoids ambiguous tap targets on a small card.

**Color**:
- Pending state: `colors.primary` (`#536253`) — Sage, grounding and legible
- Approved/scheduled state: `colors.outlineVariant` (`#abb4b3`) — recedes once actioned, "done" signal
- (Dismissed: no icon rendered)

**Placement within ThoughtListCard**:
The timestamp row currently renders `timestampText` alone at the bottom of the card gap stack. The bell icon sits in the same row, to the right of the timestamp, using `flexDirection: "row"`, `alignItems: "center"`, `justifyContent: "space-between"` on a wrapper view. The timestamp text takes `flex: 1` so the icon is pinned to the trailing edge.

Schematic of the card bottom row:

```
[ 2 hours ago                        🔔 ]
```

The icon never wraps to its own line — if the timestamp is long, it truncates with `numberOfLines={1}` rather than crowding the icon.

**No label alongside the icon** — the icon alone is sufficient for a returning user. Accessibility label is provided programmatically (see Accessibility section).

### Behaviour

- The icon renders when `thought.reminders` contains one or more rows where `status = 'pending'` (not yet approved or dismissed).
- The icon switches to the filled `notifications` variant when all reminders for that thought are `status = 'approved'`.
- The icon is removed entirely when all reminders are `status = 'dismissed'` or when there are no reminders.
- The icon does not animate on mount — it appears statically with the card render. No pulsing or attention animation (respects the serene aesthetic and `prefers-reduced-motion`).

### Accessibility

- The timestamp row wrapper carries `accessibilityLabel` that includes the reminder state, e.g.: `"2 hours ago, has a pending reminder"` or `"2 hours ago, reminder scheduled"`.
- The icon itself is `accessibilityElementsHidden={true}` / `importantForAccessibility="no"` — the parent row's label conveys the full meaning.
- Color is not the only indicator: icon fill state (outline vs filled) changes alongside color to serve users with color vision differences.

---

## 2. Pending-Reminders Pill (Thoughts Header)

### Visual spec

The pill is a compact inline element rendered in the Thoughts (inbox) screen above the FlatList. It sits between the top `SafeAreaView` edge and the list content, as a new header row — not inside the FlatList `ListHeaderComponent` because it must remain visible during scroll. It is rendered as a `Pressable` pill outside the FlatList, in the `SafeAreaView` content area before the FlatList is mounted.

**Layout**:
- A single horizontally-centred row, `paddingHorizontal: spacing.s4`, `paddingTop: spacing.s4`, `paddingBottom: 0` (the `listContent` padding handles top space for the list items below).
- The pill itself is `alignSelf: "flex-start"` — left-aligned with the list content. It does not span the full width.

**Pill anatomy**:
```
[ 🔔  3 reminders to review  › ]
```
- Left: bell icon `Ionicons notifications` size 14pt, color `colors.onPrimaryContainer`
- Middle: label text
- Right: chevron `Ionicons chevron-forward` size 14pt, color `colors.onPrimaryContainer`
- All three elements in a `flexDirection: "row"`, `alignItems: "center"`, `gap: 6pt` row

**Pill container**:
- Background: `colors.primaryContainer` (`#d7e7d3`) — the tinted sage container
- `borderRadius: radius.full` (pill shape)
- `paddingVertical: 8pt` (spacing.s2)
- `paddingHorizontal: spacing.s4` (16pt)
- Minimum touch target height: 44pt — achieved by wrapping in a `Pressable` with `minHeight: 44`, `justifyContent: "center"`

**Label text**:
- Font: `PlusJakartaSans_600SemiBold`, 13pt (between `labelMd` 12pt and `bodyLg` 16pt — intentionally compact)
- Color: `colors.onPrimaryContainer` (`#122612`)
- Content: singular/plural aware — `"1 reminder to review"` vs `"3 reminders to review"`

**Hidden state**: when count is 0, the pill wrapper renders `null` — no empty placeholder, no collapsed space. The list begins at the standard top padding.

**Pressed state**: background shifts to `colors.primaryContainer` at 70% opacity (achieved with `activeOpacity: 0.7` on a `TouchableOpacity` wrapper) — consistent with the "no darken, reduce opacity" interaction model used elsewhere in the app.

### Behaviour

Step 1: User opens Thoughts tab. Backend query resolves `pendingReminderCount` (count of `reminders` rows where `status = 'pending'` for this user).
Step 2: If count ≥ 1, pill renders above the list with the count.
Step 3: User taps the pill → Reminder Approval Sheet slides up from bottom.
Step 4: User works through the sheet. On sheet close, `pendingReminderCount` re-queries; pill updates or disappears.
Step 5: If all pending reminders are approved or dismissed, pill disappears on the next focus/refresh cycle.

The count in the pill is a snapshot from the last data load — it does not need live real-time updates. `useFocusEffect` re-query (consistent with how the inbox already refreshes on focus) is sufficient.

Edge case: if the user has never had a reminder detected, the pill is never shown.

### Accessibility

- `accessibilityRole="button"`
- `accessibilityLabel`: `"Review pending reminders, {count} waiting"` — screen reader announces count and intent clearly
- `accessibilityHint`: `"Opens the reminders review sheet"`
- The pill must have sufficient colour contrast: `colors.onPrimaryContainer` (`#122612`) on `colors.primaryContainer` (`#d7e7d3`) — dark text on light sage green. Contrast ratio is approximately 9.5:1, well above the 4.5:1 WCAG AA requirement for normal text.

---

## 3. Reminder Approval Sheet

### Visual spec

The Approval Sheet is a **bottom sheet modal** using React Native's `Modal` component with `animationType="slide"` and `transparent={true}`, consistent with the existing Settings and Language Picker sheets in `src/app/(app)/index.tsx`.

**Sheet container**:
- Background: `colors.surfaceContainerLowest` (`#ffffff`)
- `borderTopLeftRadius: radius.xl` (32pt)
- `borderTopRightRadius: radius.xl` (32pt)
- `padding: spacing.s8` (32pt) on top and sides
- `paddingBottom: spacing.s12` (48pt) to clear home indicator / navigation bar safe area
- `maxHeight: "85%"` — sheet never covers more than 85% of the viewport, leaving a visible strip of the inbox behind (reinforces the "modal overlay" mental model and allows tap-to-dismiss on the backdrop)
- Ambient shadow on the sheet: `shadows.card` values applied to the top edge (`shadowOffset: { width: 0, height: -8 }`, `shadowOpacity: 0.06`, `shadowRadius: 32`)

**Backdrop**: `colors.onSurface` at 40% opacity (`${colors.onSurface}66`) — same as the Settings modal backdrop.

**Sheet title row**:
- Left: `"Reminders to review"` in `typography.headlineMd` (Manrope_600SemiBold, 28pt), `colors.onSurface`
- Right: Close button — `Ionicons close` icon, size 24pt, wrapped in a 44x44pt `Pressable` with `borderRadius: radius.full`, pressed background `colors.surfaceContainerHigh`
- `flexDirection: "row"`, `justifyContent: "space-between"`, `alignItems: "flex-start"`

**Scrollable list area**:
- A `ScrollView` with `showsVerticalScrollIndicator={false}`, `keyboardShouldPersistTaps="handled"`
- `gap: spacing.s4` (16pt) between reminder items via a `gap` style on the `ScrollView` content container
- `marginTop: spacing.s6` (24pt) below the title

### List item anatomy

Each pending reminder is rendered as a self-contained card-like row. It uses a `surfaceContainerLow` background to lift it slightly from the sheet's `surfaceContainerLowest` base — consistent with the tonal layering principle (no border lines).

**Item container**:
- Background: `colors.surfaceContainerLow` (`#f1f4f3`)
- `borderRadius: radius.lg` (24pt)
- `padding: spacing.s6` (24pt)
- `gap: spacing.s4` (16pt) between internal sections

**Section A — Extracted text snippet**:
- A short excerpt of the original thought body, showing the time-reference in context (e.g. `"…call the dentist next Tuesday afternoon…"`). The AI-extracted snippet is shown in a dedicated `View` with background `colors.surfaceContainerHigh` (`#e3e9e8`), `borderRadius: radius.md` (16pt), `paddingVertical: spacing.s2` (8pt), `paddingHorizontal: spacing.s4` (16pt).
- Text style: `typography.bodyLg`, `colors.onSurfaceVariant`, `fontStyle: "italic"` — the italic distinguishes the quoted excerpt from the UI chrome.
- `numberOfLines={3}` — truncates gracefully for long captures; no "show more" needed (the full thought is accessible in the detail view).
- Preceding micro-label: `"Detected in your thought"` — `typography.labelMd`, `colors.outlineVariant`, displayed above the excerpt block.

**Section B — AI-suggested date and time**:
- Micro-label: `"Suggested reminder"` — `typography.labelMd`, `colors.outlineVariant`
- The suggested date+time renders as a tappable row that opens the native DateTimePicker.
- Row layout: `flexDirection: "row"`, `alignItems: "center"`, `justifyContent: "space-between"`
- Left side: formatted date + time string (e.g. `"Tuesday, 8 April · 14:00"`) in `PlusJakartaSans_600SemiBold`, 16pt, `colors.onSurface`
- Right side: `Ionicons pencil-outline` icon, 16pt, `colors.secondary` — signals editability without a full "Edit" label
- The entire row is a `Pressable` with `minHeight: 44pt`, `borderRadius: radius.md`, pressed state background `colors.surfaceContainerHigh`.
- When the user taps this row, the native DateTimePicker opens (see iOS vs Android notes below). On confirm, the formatted string updates in place.

**Section C — Action row**:
- `flexDirection: "row"`, `gap: spacing.s4`, `marginTop: spacing.s2`
- **Approve button**: full `Button` component, `variant="primary"`, label `"Approve"`, `flex: 1`. On press: sets `status = 'approved'` for this reminder row, removes item from the sheet list with a fade-out animation (150ms ease-out), updates the pending count in the header pill.
- **Dismiss button**: full `Button` component, `variant="secondary"`, label `"Dismiss"`, `flex: 1`. On press: sets `status = 'dismissed'`, removes item from sheet with the same fade animation.
- Both buttons have `minHeight: 44pt` (enforced by the `Button` component's existing full-radius pill shape with `paddingVertical: spacing.s4`).

**Full list item schematic**:
```
┌────────────────────────────────────────┐
│  Detected in your thought              │
│  ┌──────────────────────────────────┐  │
│  │ "…call the dentist next          │  │
│  │  Tuesday afternoon…"             │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Suggested reminder                    │
│  Tuesday, 8 April · 14:00        ✏    │
│                                        │
│  [ Approve ]        [ Dismiss ]        │
└────────────────────────────────────────┘
```

### Empty state

When all pending reminders have been actioned (approved or dismissed) during the current session, the `ScrollView` content is replaced with a centred empty state view.

**Empty state layout**:
- Vertically centred within the sheet's available height
- Icon: `Ionicons checkmark-circle-outline`, size 48pt, `colors.primaryContainer` (`#d7e7d3`) — a gentle, non-celebratory confirmation
- Heading: `"All caught up"` — `typography.headlineMd` (Manrope_600SemiBold, 28pt), `colors.onSurface`, `textAlign: "center"`
- Body: `"No reminders waiting for your review."` — `typography.bodyLg`, `colors.outlineVariant`, `textAlign: "center"`, `marginTop: spacing.s2`
- A `"Close"` button (`Button`, `variant="secondary"`) appears below with `marginTop: spacing.s8`, centred, `minWidth: 120pt`

The sheet does not auto-close when reaching empty state — the user closes it deliberately. This avoids a jarring automatic dismissal.

### Behaviour / interactions

**Opening the sheet**:
- Tap the pending-reminders pill in the Thoughts header → sheet slides up (`animationType="slide"`, 300ms consistent with `animation.driftDuration` intent but using the native Modal slide — no custom spring needed here).
- Tap the bell icon area on a `ThoughtListCard` — per the bell icon spec above, the bell is not independently tappable. However, the task spec also requires the sheet to open from the bell. Resolution: the bell icon tap is handled by making the bottom row of the card (timestamp + bell row) a `Pressable` region with a dedicated `onBellPress` callback prop, separate from the card's `onPress` (which navigates to thought detail). The bell row `Pressable` has `minHeight: 44pt` and calls `onBellPress` when the bell icon is present. This keeps the navigation tap target (full card) and the bell tap target (bottom row) unambiguous — the user taps the card body to read the thought, and taps the bottom row to open reminders.
- When opened from a bell icon tap, the sheet scrolls to (or highlights) the reminder(s) belonging to that specific thought. Highlight is a brief background pulse on the item: `colors.primaryContainer` at 30% opacity, 400ms fade-in then fade-out. `prefers-reduced-motion` fallback: no pulse, item is simply the first visible item.

**Removing items**:
Step 1: User taps Approve or Dismiss on a list item.
Step 2: Optimistic UI — item fades out over 150ms ease-out. The sheet list height collapses smoothly (React Native `LayoutAnimation.easeInEaseOut()` triggered before state update).
Step 3: API call updates `reminders.status` in the database.
Step 4: If the API call fails, the item reappears with a toast notification: `"Couldn't save — try again."` using `role="alert"` so screen readers announce it.

**Dismissing the sheet**:
- Tapping the backdrop closes the sheet.
- Tapping the X close button closes the sheet.
- Android hardware back button closes the sheet (`onRequestClose` handler).
- Escape key (hardware keyboard / accessibility keyboard) closes the sheet.

**Focus trap**: while the sheet is open, focus is trapped within the sheet. On open, focus moves to the sheet title. On close, focus returns to the element that opened the sheet (pending-reminders pill or the thought card row).

### iOS vs Android notes (DateTimePicker)

`@react-native-community/datetimepicker` (bundled with Expo) behaves differently per platform. The spec accounts for both.

**iOS**:
- The picker is presented as an inline `Modal` or an `action sheet`-style bottom panel, not inline within the approval sheet itself (nesting two sheet-style surfaces would be confusing).
- Implementation pattern: a second `Modal` with `animationType="slide"` opens above the approval sheet, containing the `DateTimePicker` in `display="spinner"` mode for date selection, followed by a time picker in the same panel. Confirm and Cancel buttons in the overlay close it.
- The overlay uses the same sheet styles (`surfaceContainerLowest` background, `radius.xl` top corners, `spacing.s8` padding).
- Date and time are selected in two sequential steps within the same overlay: first mode `"date"`, then after date confirm the picker switches to mode `"time"`.

**Android**:
- The native Android date/time picker opens as a system dialog (not a sheet) — this is the default `DateTimePicker` behaviour on Android and cannot be restyled. The approval sheet remains visible behind the system dialog.
- After the user confirms the date in the system date picker, programmatically open the time picker immediately (mode `"time"`). This matches Android's standard sequential date+time selection pattern.
- No custom modal wrapper needed on Android.

Both platforms: the selected date/time must not be in the past. If the user selects a past time, show an inline error below the date row: `"Choose a future date and time"` in `typography.labelMd`, `colors.error`, with `role="alert"` for screen reader announcement.

### Accessibility

- Sheet: `accessibilityViewIsModal={true}` (iOS), ensures VoiceOver treats the sheet as a modal
- Sheet container: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the title element's `nativeID`
- Focus management: on sheet open, programmatically focus the title `Text` element (via `ref` + `focus()`); on close, return focus to the triggering element
- Keyboard navigation: all interactive elements reachable in logical order — title → first item's date row → Approve → Dismiss → next item → ... → Close button
- Approve and Dismiss buttons: `accessibilityLabel` must include the context of what is being approved/dismissed, e.g. `"Approve reminder for call the dentist"` and `"Dismiss reminder for call the dentist"` (derived from the first few words of the extracted snippet)
- Date row: `accessibilityRole="button"`, `accessibilityLabel`: `"Reminder time: Tuesday, 8 April at 14:00. Tap to change."`
- Item removal: when an item is removed, announce `"Reminder approved"` or `"Reminder dismissed"` via an `aria-live="polite"` region
- Empty state: `accessibilityRole="text"`, `accessibilityLabel="All reminders reviewed, none remaining"`

---

## 4. Notification Settings Additions

### Visual spec

The new notification settings fields are added to the existing Settings sheet (`settingsModalSheet`) in `src/app/(app)/index.tsx`. They slot in between the existing "Voice transcription language" row and the "Sign out" hint text, maintaining the sheet's existing vertical rhythm.

A visual section separator between the transcription language setting and the new reminder settings is created via a `View` with `height: 1pt`, `backgroundColor: colors.surfaceContainerHigh`, `marginVertical: spacing.s2` — this is the one context where a visible line is appropriate as an organisational separator within a settings list, but it must be extremely subtle: the `surfaceContainerHigh` (`#e3e9e8`) on `surfaceContainerLowest` (`#ffffff`) background creates a barely-perceptible rule that divides the two setting categories without violating the "no harsh borders" principle.

A section label above the new fields: `"Reminders"` in `typography.labelMd` (Plus Jakarta Sans, 12pt), `colors.outlineVariant`, `letterSpacing: 0.5`, uppercased — this follows the standard settings-list section header pattern used in iOS and Android system settings and immediately communicates the scope of the settings below.

### Lead-time selector

**Purpose**: Let the user configure how far in advance of a detected reminder time the push notification fires.

**Pattern**: Single-select list of options, rendered as a `Pressable` row showing the current selection with a chevron (matching the existing `settingsLanguageRow` pattern exactly). Tapping opens a picker sheet (the same pattern as the language picker — a second `Modal` with a scrollable option list).

**Options** (in display order):
1. `"At the time"` — notification fires at the exact moment
2. `"15 minutes before"` — default
3. `"30 minutes before"`
4. `"1 hour before"`
5. `"In the morning"` — notification fires on a user-configurable morning time on the same day as the event (or the day before if the event is before the morning time)

**Default**: `"15 minutes before"` — a sensible middle ground that gives the Quiet Thinker just enough lead time without being premature.

**Row appearance** (matches `settingsLanguageRow` pattern):
- `flexDirection: "row"`, `justifyContent: "space-between"`, `alignItems: "center"`, `paddingVertical: spacing.s4`, `paddingHorizontal: spacing.s2`
- Left block: label `"Reminder lead time"` in `PlusJakartaSans_600SemiBold`, 16pt, `colors.onSurface`; hint text `"How far in advance you are notified"` in `typography.labelMd`, 13pt, `colors.secondary`
- Right block: current selection label in `typography.bodyLg`, `colors.secondary`; `Ionicons chevron-forward` 20pt, `colors.secondary`
- Pressed state: `colors.surfaceContainerHigh` background, `borderRadius: radius.md`
- `minHeight: 44pt` (touch target requirement)

**Picker sheet** (opened by tapping the row):
- Reuses `languagePickerSheet` / `languagePickerTitle` / `languageOptionRow` styles exactly
- Title: `"Remind me"`
- Each option is a row with the option label and a checkmark icon when selected (same as language picker)
- `accessibilityRole="button"`, `accessibilityState={{ selected }}` on each row
- The `"In the morning"` option row has a `"›"` trailing indicator instead of a checkmark when selected, signalling that additional configuration is available

### Morning time picker (conditional)

**Shown only when**: `"In the morning"` is the selected lead-time option.

**Placement**: Renders as an additional settings row immediately below the lead-time row within the main Settings sheet (not inside the picker sheet). It appears/disappears with a smooth height animation when the lead-time selection changes. Motion: `LayoutAnimation.easeInEaseOut()` with 300ms duration. `prefers-reduced-motion` fallback: instant show/hide (no animation).

**Row appearance**:
- Same row pattern as the lead-time row (matches `settingsLanguageRow`)
- Label: `"Morning time"` in `PlusJakartaSans_600SemiBold`, 16pt, `colors.onSurface`
- Hint: `"Reminders will be sent at this time on the relevant morning"` in `typography.labelMd`, 13pt, `colors.secondary`
- Right side: formatted time string, e.g. `"07:30"` in `typography.bodyLg`, `colors.secondary`; `Ionicons chevron-forward` 20pt, `colors.secondary`
- Tapping the row opens the native time picker (platform-appropriate pattern below)
- Default value: `07:30`

**iOS time picker**:
- Opens a `Modal` bottom sheet (same sheet style as settings) containing a `DateTimePicker` in `display="spinner"` mode with `mode="time"`. Confirm and Cancel buttons at the bottom.
- 12-hour vs 24-hour format follows the device locale setting automatically (DateTimePicker respects `locale`).

**Android time picker**:
- Opens the native system time picker dialog directly.
- Same locale-aware 12/24 hour behaviour.

### Behaviour

- All settings changes are persisted immediately on selection (optimistic — no "Save" required), consistent with the existing transcription language behaviour (`setTranscriptionLanguage` is called inline on selection in the language picker).
- If persistence fails (e.g. AsyncStorage write error), show a toast: `"Couldn't save setting"` via `role="alert"`.
- The Settings sheet does not need a "Save" button for these new fields — settings are applied at selection.
- The morning time picker change is debounced 500ms before persisting to avoid rapid writes during spinner interaction.

### Accessibility

**Lead-time row**:
- `accessibilityRole="button"`
- `accessibilityLabel`: `"Reminder lead time: 15 minutes before. Tap to change."`
- `accessibilityHint`: `"Opens options for how far in advance you receive reminders"`

**Lead-time picker options**:
- `accessibilityRole="button"` on each row
- `accessibilityState={{ selected: true/false }}`
- `accessibilityLabel`: option label, e.g. `"15 minutes before"` / `"In the morning, opens morning time setting"`

**Morning time row**:
- Only rendered when relevant — screen readers will not encounter it when the option is not selected
- `accessibilityRole="button"`
- `accessibilityLabel`: `"Morning reminder time: 07:30. Tap to change."`

**Section label** (`"Reminders"`):
- `accessibilityRole="header"` — announces as a section heading to screen readers

---

## Component summary for @react-native-developer

| New element | Location | Type | Key tokens |
|---|---|---|---|
| Bell icon in timestamp row | `ThoughtListCard.tsx` | Passive indicator | `colors.primary`, `colors.outlineVariant`, `Ionicons notifications-outline/notifications`, 16pt |
| Bottom row Pressable (bell tap) | `ThoughtListCard.tsx` | New `Pressable` wrapper on timestamp row | `minHeight: 44pt`, `onBellPress` callback prop |
| Pending-reminders pill | `inbox/index.tsx` | New `Pressable` above `FlatList` | `colors.primaryContainer`, `colors.onPrimaryContainer`, `radius.full`, 44pt min-height |
| Reminder Approval Sheet | New component `ReminderApprovalSheet.tsx` | `Modal` bottom sheet | All sheet tokens, `radius.xl` top corners, `maxHeight: "85%"` |
| Reminder list item | Inside `ReminderApprovalSheet` | Sub-component | `colors.surfaceContainerLow`, `radius.lg`, `spacing.s6` |
| Lead-time setting row | `index.tsx` (Settings modal) | `Pressable` row | Matches `settingsLanguageRow` styles |
| Lead-time picker sheet | `index.tsx` | `Modal`, matches language picker sheet | Reuses `languagePickerSheet` styles |
| Morning time row | `index.tsx` (Settings modal, conditional) | `Pressable` row | Same as lead-time row, animated show/hide |

### Props to add to `ThoughtListCard`

```
hasPendingReminder?: boolean   — renders bell icon in pending (primary) colour
hasApprovedReminder?: boolean  — renders bell icon in approved (outlineVariant) colour
onBellPress?: () => void       — called when the timestamp/bell row is tapped (only when a bell is visible)
```

When neither `hasPendingReminder` nor `hasApprovedReminder` is true, the timestamp row renders exactly as today with no changes.

---

## Motion summary

| Animation | Duration | Easing | Reduced-motion fallback |
|---|---|---|---|
| Sheet slide-in | Native Modal slide (~300ms) | Native | Static appear |
| Item remove (fade + collapse) | 150ms fade + `LayoutAnimation` collapse | ease-out | Instant removal |
| Morning time row show/hide | 300ms `LayoutAnimation` | ease-in-out | Instant show/hide |
| Bell highlight pulse (from bell tap) | 400ms fade-in/out | ease-in-out | No pulse |
| Sheet backdrop | Native (Modal transparent) | — | — |

All non-essential animations must be wrapped in a `prefers-reduced-motion` check via `AccessibilityInfo.isReduceMotionEnabled()` or the `useReducedMotion` hook pattern.

---

## Open questions for @react-native-developer

1. **Reminder data model**: This spec assumes a `reminders` table with at minimum `id`, `thought_id`, `user_id`, `status` (`pending` / `approved` / `dismissed`), `suggested_at` (datetime), `extracted_snippet` (text), `scheduled_at` (datetime — the user-confirmed time). Confirm schema with @database-expert before implementation (task #022 architecture should define this).

2. **Lead-time persistence**: This spec assumes the lead-time and morning-time settings are stored in `AsyncStorage` on-device (consistent with how transcription language is currently stored in `src/lib/transcriptionLanguage.ts`). Confirm with @systems-architect whether these should be persisted to Supabase user preferences instead.

3. **`hasPendingReminder` data loading**: The inbox query in `inbox/index.tsx` currently fetches `id, body, topics, transcription_status, tagging_status, created_at`. A join or separate query is needed to determine reminder status per thought. Confirm query strategy with @database-expert.

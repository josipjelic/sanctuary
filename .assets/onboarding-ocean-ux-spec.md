# OCEAN Onboarding & Morning Message Card — UX Specification

> Feature: OCEAN Personality Onboarding & Personalised Morning Messages
> Author: @ui-ux-designer
> Created: 2026-04-11
> For implementation by: @react-native-developer (task #041)
> Design system reference: `src/lib/theme.ts`, `.assets/DESIGN.md`
> ADR reference: ADR-005

---

## Design intent

**Design story**: "Your sanctuary begins here." This is a quiet conversation, not a personality quiz. The user is being *heard* — not evaluated. The onboarding borrows language and pacing from a journaling ritual: long pauses, generous whitespace, open-ended reflective prompts that invite honest writing rather than calculated self-presentation.

The visual language channels early-morning softness: a gentle gradient from `primaryContainer` (`#d7e7d3`) to `surface` (`#f9f9f8`) at ~15°, as if morning light is washing across parchment. Typography is unhurried. Buttons appear only when needed. The OCEAN framework is never named or surfaced to the user — it lives entirely behind the curtain.

**Mood**: Still. Unhurried. Trusted.

---

## Persona grounding

Both personas encounter this flow immediately after sign-up.

**The Quiet Thinker** arrives with ambient anxiety about productivity apps collecting data on them. The design must feel unlike a corporate onboarding. Open-ended prompts with no right answer, no word count enforcement, and explicit reassurance copy ("there are no right answers") reduce that anxiety. The skip affordance for optional questions respects their time without making them feel judged for skipping.

**The Reflective Journaler** will lean into the questions — they may write paragraphs. The `TextInput` must be generous in height (auto-expanding), the keyboard must not obscure the question, and the navigation controls must stay accessible at all times. They will appreciate the gentle transition to optional questions: it signals depth without demanding it.

---

## Design system quick-reference

All values drawn from `src/lib/theme.ts`. No new tokens are introduced.

| Token | Value | Notes |
|---|---|---|
| `colors.primary` | `#536253` | CTA backgrounds, active stepper dots, focus indicators |
| `colors.onPrimary` | `#ecfce8` | Text on primary buttons |
| `colors.primaryContainer` | `#d7e7d3` | Gradient start, active state tints |
| `colors.onPrimaryContainer` | `#122612` | Labels on tinted fills |
| `colors.surface` | `#f9f9f8` | Screen background (Parchment) |
| `colors.surfaceContainerLowest` | `#ffffff` | Question card background, pure lift |
| `colors.surfaceContainerLow` | `#f1f4f3` | Input field container |
| `colors.surfaceContainerHigh` | `#e3e9e8` | Pressed states |
| `colors.onSurface` | `#2c3433` | Primary text |
| `colors.onSurfaceVariant` | `#3f4948` | Secondary text, question body |
| `colors.outlineVariant` | `#abb4b3` | Stepper inactive dots, metadata |
| `colors.secondary` | `#576165` | Hint text, secondary labels |
| `colors.error` | `#9e422c` | Error states |
| `typography.displayLg` | Manrope_700Bold, 56pt | Welcome headline only |
| `typography.headlineMd` | Manrope_600SemiBold, 28pt | Screen headlines, question text |
| `typography.bodyLg` | PlusJakartaSans_400Regular, 16pt | Body copy, TextInput, hint text |
| `typography.labelMd` | PlusJakartaSans_400Regular, 12pt | Stepper label, metadata |
| `spacing.s2` | 8pt | Tight gaps |
| `spacing.s4` | 16pt | Standard gaps |
| `spacing.s6` | 24pt | Card padding |
| `spacing.s8` | 32pt | Screen horizontal padding |
| `spacing.s12` | 48pt | Safe-area bottom buffer |
| `spacing.s16` | 64pt | Vertical breathing room |
| `spacing.s20` | 80pt | Hero section top margin |
| `radius.lg` | 24pt | Question card corners |
| `radius.xl` | 32pt | Morning message card corners |
| `radius.full` | 9999 | Buttons, pill stepper |
| `shadows.card` | Y:8, Blur:32, onSurface 4% | Ambient elevation on cards |
| `animation.driftDuration` | 500ms | Screen transitions |

---

## Screen 1 — Welcome (`(onboarding)/index.tsx`)

### User goal
Understand what Sanctuary is and feel safe enough to begin a reflective conversation.

### Visual layout

**Background**: Linear gradient, 15° angle, from `colors.primaryContainer` (`#d7e7d3`) at top to `colors.surface` (`#f9f9f8`) at bottom. Covers the full screen behind all content.

**Safe area insets**: `SafeAreaView` with `edges={["top", "bottom"]}`.

**Layout**: Single `ScrollView` (to handle small screens), content vertically centered with `justifyContent: "center"`, `paddingHorizontal: spacing.s8` (32pt).

**Content stack** (top to bottom, with generous gaps):

1. **Brand mark** — `marginTop: spacing.s20` (80pt from top safe area)
   - `"sanctuary"` wordmark in `typography.labelMd`, `colors.primary`, `letterSpacing: 4` — all lowercase, widely tracked. Functions as a quiet anchor, not a shout.
   - `marginBottom: spacing.s12` (48pt below wordmark)

2. **Headline** — `typography.displayLg` (Manrope Bold, 56pt), `colors.onSurface`, `lineHeight: 64`
   - Copy: `"Let's get to know you."`
   - Left-aligned. Intentional asymmetry: no centering here. The headline bleeds to the left edge, occupying ~70% of the viewport width. The remaining 30% is pure parchment — breathing room.
   - `marginBottom: spacing.s4` (16pt)

3. **Subheadline** — `typography.headlineMd` (Manrope SemiBold, 28pt), `colors.onSurfaceVariant`
   - Copy: `"Your answers shape a personal sanctuary — and the gentle nudges that help you flourish."`
   - Left-aligned, `marginBottom: spacing.s6` (24pt)

4. **Body copy** — `typography.bodyLg` (Plus Jakarta Sans, 16pt), `colors.secondary`, `lineHeight: 26`
   - Copy: `"You'll answer a few open-ended questions. There are no right answers — only yours. It takes about three minutes."`
   - Left-aligned, `marginBottom: spacing.s16` (64pt — generous pause before CTA)

5. **Primary CTA** — `Button` component, `variant="primary"`, full border radius
   - Label: `"Begin"`
   - `width: "100%"` — spans full content width
   - On press: navigate to `(onboarding)/questions` (no back-stack entry needed; `router.push`)
   - Minimum touch target: 52pt tall (achieved by `paddingVertical: spacing.s4 + 2` within the `Button` component — override if needed)

6. **Privacy micro-copy** — `marginTop: spacing.s4` (16pt below CTA)
   - `"Your reflections are private and never shared."` in `typography.labelMd` (12pt), `colors.outlineVariant`, `textAlign: "center"`

**Bottom safe-area buffer**: `paddingBottom: spacing.s12` (48pt)

### Behaviour

Step 1: Screen renders immediately after route guard resolves (splash screen still visible until fonts load, per existing `_layout.tsx` behaviour).
Step 2: User taps "Begin" → screen transition to questions screen.
Step 3: On back press (Android hardware back): no navigation backwards into auth — `router.replace` to auth or ignore is handled by the route guard; this screen should have no explicit back handler.

### Accessibility
- `accessibilityLabel` on brand wordmark: `"Sanctuary"`
- Headline: `accessibilityRole="header"`
- Privacy copy: `accessibilityRole="text"`
- CTA: `accessibilityRole="button"`, `accessibilityLabel="Begin the onboarding questions"`

### Motion
- Screen entrance: `FadeIn` from `opacity: 0` to `opacity: 1`, 500ms, `animation.driftDuration`. Content fades in as a single block — no staggered animations (they imply urgency and conflict with the serene aesthetic).
- `prefers-reduced-motion` fallback: instant render at full opacity.

---

## Screen 2 — Questions (`(onboarding)/questions.tsx`)

### User goal
Answer reflective questions honestly and at their own pace, without feeling tested or timed.

### Screen structure overview

This is a single screen that advances through questions 1–5, then presents the optional transition and questions 6–7. State is managed client-side; all answers accumulate in a local array before submission on the scoring screen.

### Progress stepper

**Design**: A horizontal row of 7 dots (5 primary + 2 optional). Positioned at the top of the screen, centered horizontally, `marginTop: spacing.s8` (32pt from safe area top edge).

**Dot anatomy**:
- Active dot (current question): `width: 24pt`, `height: 8pt`, `borderRadius: radius.full`, `backgroundColor: colors.primary` — a pill shape that expands horizontally to signal "you are here"
- Completed dot: `width: 8pt`, `height: 8pt`, `borderRadius: radius.full`, `backgroundColor: colors.primary`, `opacity: 0.5`
- Upcoming dot: `width: 8pt`, `height: 8pt`, `borderRadius: radius.full`, `backgroundColor: colors.outlineVariant`
- Optional dots (questions 6–7): same sizing as upcoming/completed states, but `opacity: 0.4` when not yet reached — visually de-emphasised to signal they are not mandatory
- Gap between dots: 6pt
- The active dot morphs between pill (active) and circle (completed/upcoming) with a layout animation (150ms ease-out). `prefers-reduced-motion` fallback: instant size change.

**Stepper accessibility**:
- The entire stepper row carries `accessibilityLabel` announcing current position, e.g.: `"Question 2 of 5"` or `"Optional question 1 of 2"`
- Individual dots are `accessibilityElementsHidden={true}` — the row label conveys the full context

**Stepper placement schematic**:
```
  ●━  ●  ●  ●  ●  ○  ○
  1   2  3  4  5  6  7
      (6, 7 are faintly visible — optional)
```

### Question card

**Container**: A `Card` component, `variant="elevated"`, on `colors.surfaceContainerLowest` background.
- `borderRadius: radius.lg` (24pt)
- `padding: spacing.s8` (32pt)
- `marginHorizontal: spacing.s8` (32pt — matches screen horizontal padding)
- `marginTop: spacing.s8` (32pt below stepper)
- Ambient shadow: `shadows.card`

**Question number label** (inside card, top of card):
- e.g. `"1 of 5"` or `"Optional"` (for questions 6–7)
- `typography.labelMd` (12pt), `colors.outlineVariant`, `letterSpacing: 0.5`
- `marginBottom: spacing.s4` (16pt)

**Question text**:
- `typography.headlineMd` (Manrope SemiBold, 28pt), `colors.onSurface`
- `lineHeight: 36`, maximum 3 lines before wrapping naturally (all 7 questions are designed to fit within 3 lines at this size on a 320pt-wide screen)
- `marginBottom: spacing.s6` (24pt below question text)

**Question texts** (exact copy, as specified in ADR-005):

| # | Label | Question |
|---|-------|---------|
| 1 | `"1 of 5"` | "What's something you've been curious about recently — an idea, a place, or a way of doing things that caught your attention?" |
| 2 | `"2 of 5"` | "When you think about the things you want to get done, what tends to help you follow through — and what tends to get in the way?" |
| 3 | `"3 of 5"` | "How do you tend to recharge after a busy or draining day? Describe what that usually looks like for you." |
| 4 | `"4 of 5"` | "Tell me about someone in your life you feel close to. What do you value most in that relationship?" |
| 5 | `"5 of 5"` | "What's been weighing on your mind lately? When that kind of feeling shows up, how do you usually sit with it?" |
| 6 | `"Optional"` | "Is there a creative pursuit, habit, or new way of thinking you've been wanting to explore but haven't made space for yet?" |
| 7 | `"Optional"` | "Describe a time when you felt really on top of things — organised, clear, in flow. What made that possible?" |

**Hint text** (below question text, inside card):
- `"Write as much or as little as feels right."` — `typography.labelMd` (12pt), `colors.secondary`
- Shown on all 7 questions. Consistent placement reinforces the low-stakes tone.

### TextInput

The `TextInput` component is rendered below the question card (not inside it), giving it room to expand without the card growing awkwardly tall on small screens.

**Placement**: `marginTop: spacing.s6` (24pt below card), `marginHorizontal: spacing.s8` (32pt — same as card)

**Spec**:
- `multiline: true`
- `minHeight: 120pt` — enough for 3–4 lines of text before scrolling
- `maxHeight: 240pt` — caps expansion; content scrolls within the input beyond this
- Background: `colors.surfaceContainerLow` (`#f1f4f3`)
- `borderRadius: radius.lg` (24pt)
- `padding: spacing.s6` (24pt) all sides
- Font: `typography.bodyLg` (Plus Jakarta Sans 16pt), `colors.onSurface`
- Placeholder: `"Your thoughts…"`, `colors.outlineVariant`
- Focus ring: `colors.primary` at 20% opacity ghost border (consistent with existing `TextInput` component focus behaviour)
- `returnKeyType: "next"` (iOS soft keyboard) — "next" label on the return key signals forward progress. On question 5, change to `"done"` (or `"default"`) to signal this is the last required question.
- `blurOnSubmit: false` — prevents unexpected keyboard dismissal in the multiline context
- Auto-focuses when a new question renders (after card transition completes, 200ms delay to avoid jarring keyboard pop during animation)

**Word count hint** (below TextInput):
- Rendered as a `Text` element, `alignSelf: "flex-end"`, `marginTop: spacing.s2`, `marginRight: spacing.s8`
- Shows live character count as the user types: e.g. `"42 characters"` — `typography.labelMd`, `colors.outlineVariant`
- Visible only when input is focused or contains text (fades in at 150ms ease-out when focus is gained; fades out when the input is empty and blurred)
- Not a hard limit — purely informational, reinforcing "write as much as you like"
- `prefers-reduced-motion` fallback: instant show/hide

### Navigation row

Fixed at the bottom of the screen (outside scroll area), `paddingBottom: spacing.s12` (48pt for safe area), `paddingHorizontal: spacing.s8`, `paddingTop: spacing.s4`.

**Layout**: `flexDirection: "row"`, `justifyContent: "space-between"`, `alignItems: "center"`

**Back button** (left):
- Rendered as a ghost/icon-only pressable on questions 2–5 (hidden on question 1 — no back from the welcome)
- `Ionicons arrow-back` icon, 24pt, `colors.onSurfaceVariant`
- Touch target: 44×44pt `Pressable`, `borderRadius: radius.full`, pressed state `colors.surfaceContainerHigh`
- Pressing back: returns to previous question; answer in current field is preserved (local state)
- `accessibilityRole="button"`, `accessibilityLabel="Go back to previous question"`

**Continue button** (right):
- `Button` component, `variant="primary"`, full border radius
- Label: `"Continue"` for questions 1–4; `"Finish"` for question 5; `"Continue"` for optional questions 6–7
- Enabled state: always enabled (empty answers are valid — user can proceed without answering; blank answers are submitted as `""`)
- The button does NOT require a minimum answer length. Friction-free is the principle.
- On Q5 press: if both optional question states are empty, this navigates to scoring screen. If user has started typing Q6, it saves and navigates forward to Q6.
- On Q7 press: navigates to scoring screen.
- `accessibilityRole="button"`, `accessibilityLabel` varies: `"Continue to next question"` or `"Finish and build my profile"`

### Optional question transition (between Q5 and Q6)

When the user presses "Finish" on Q5, instead of immediately navigating to the scoring screen, a **transition state** renders within the questions screen — replacing the question card.

**Transition card**:
- Same container as the question card: `Card`, `variant="elevated"`, `borderRadius: radius.lg`, `padding: spacing.s8`
- **Icon**: `Ionicons sparkles-outline` (or equivalent from the icon set — see icon system note below), 32pt, `colors.primary`, centered, `marginBottom: spacing.s4`
- **Headline**: `"Two more if you'd like to share."` — `typography.headlineMd` (Manrope SemiBold, 28pt), `colors.onSurface`, `textAlign: "center"`
- **Body**: `"Or skip straight to your sanctuary — your profile is already forming."` — `typography.bodyLg`, `colors.secondary`, `textAlign: "center"`, `marginTop: spacing.s4`

**Navigation for this transition state**:
- The **Continue** button label becomes `"Share more"` → navigates to Q6
- A secondary **Skip** action renders above or below the Continue button (not as a button — as a text-link pattern to visually de-prioritise it):
  - `"Skip to my sanctuary →"` — `PlusJakartaSans_600SemiBold`, 14pt (between `labelMd` and `bodyLg`), `colors.primary`, `textAlign: "center"`, `paddingVertical: spacing.s4` touch target
  - On press: navigates directly to scoring screen (Q6 and Q7 answers sent as `""`)
  - `accessibilityRole="button"`, `accessibilityLabel="Skip optional questions and go to your sanctuary"`
- The stepper shows the active dot on position 6 (first optional dot) to signal where you are

### Question-to-question transition animation

When moving forward (Continue press):
- Current card + input slides out to the left (translateX: `0` → `-screenWidth`, 250ms, `cubic-bezier(0.4, 0, 0.2, 1)`)
- New card + input slides in from the right (translateX: `screenWidth` → `0`, 250ms, same easing, starting 50ms after exit begins)
- `prefers-reduced-motion` fallback: cross-fade, 150ms ease-in-out (no lateral movement)

When moving backward (Back press):
- Reverse: exit to right, enter from left.

The keyboard does not dismiss between questions — `TextInput` auto-focuses immediately on the new question's input after the slide completes.

### Behaviour flow summary

```
Step 1: Questions screen loads → Q1 card renders → TextInput auto-focuses
Step 2: User types answer (or leaves empty) → taps "Continue"
  → answer saved to local answers array at index [0]
  → Q1 card slides left, Q2 card slides in from right
Step 3: Q2–Q5 follow the same pattern
Step 4: User taps "Finish" on Q5 (or "Continue" on optional questions)
  → if transitioning to optional: transition card renders (see above)
  → if skipping: navigate to (onboarding)/scoring with full answers array as route param (or context)
Step 5: Q6 and Q7 follow same card/input pattern (optional label shown)
Step 6: "Finish" on Q7 or "Skip" → navigate to (onboarding)/scoring
Edge case: Back pressed on Q1 → no-op (or if UX needs it, navigate back to welcome — confirm with @react-native-developer)
Edge case: App backgrounded mid-flow → answers are held in component state. On foreground, screen resumes at current question. No persistence to AsyncStorage needed (onboarding is a one-shot flow).
```

### Accessibility

- On each question change: announce the new question number to screen readers via an `aria-live="polite"` region: `"Question {n} of 5"` or `"Optional question {n} of 2"`
- `TextInput`: `accessibilityLabel` matches the question text (not the placeholder)
- `accessibilityHint`: `"Your answer is private and will not be shared"`
- Continue/Finish button: disabled state never actually applied (empty is valid), so no disabled announcement needed
- Focus order per question screen: stepper row → question card → TextInput → navigation row

---

## Screen 3 — Scoring / Loading (`(onboarding)/scoring.tsx`)

### User goal
Feel reassured that something meaningful is happening — and that the wait is worth it.

### Visual layout

**Background**: Same linear gradient as the welcome screen (15°, `primaryContainer` → `surface`).

**Layout**: `SafeAreaView`, `flex: 1`, `justifyContent: "center"`, `alignItems: "center"`, `paddingHorizontal: spacing.s8`.

**Content** (vertically centered, no scroll):

1. **Breathing circle animation**
   - A single circle, `width: 80pt`, `height: 80pt`, `borderRadius: radius.full`
   - Background: `colors.primaryContainer` (`#d7e7d3`)
   - Animation: scale pulses between `1.0` and `1.15` continuously while loading
     - Duration: 1200ms per cycle (expand: 600ms ease-in-out, contract: 600ms ease-in-out)
     - Loop: repeating
   - `prefers-reduced-motion` fallback: static circle at scale `1.0` — no pulse
   - The circle has no icon inside it — pure abstract form, a moment of visual breath
   - `marginBottom: spacing.s8` (32pt below circle)

2. **Headline** — `typography.headlineMd` (Manrope SemiBold, 28pt), `colors.onSurface`, `textAlign: "center"`
   - Copy: `"Getting to know you…"`
   - `marginBottom: spacing.s4`

3. **Body copy** — `typography.bodyLg`, `colors.secondary`, `textAlign: "center"`, `lineHeight: 26`
   - Copy: `"We're reading between the lines of your answers to understand what makes you, you."`
   - `marginBottom: spacing.s16` (64pt — space before the next element, if any)

4. **Micro-copy** — `typography.labelMd`, `colors.outlineVariant`, `textAlign: "center"`
   - Copy: `"This only takes a moment."`

### Behaviour

```
Step 1: Screen mounts → POST /score-ocean-profile called immediately with accumulated answers array
Step 2: While awaiting response: breathing circle animation plays; copy is displayed
Step 3a: Success response received → navigate to (onboarding)/complete (router.replace — no back)
Step 3b: Error response (network failure, 5xx): show error state (see below)
Minimum display time: 1500ms — even if the API responds in 200ms, hold on this screen for at least 1.5s. Rushing from "loading" to "complete" in under a second feels broken, not fast.
```

**Error state** (replaces the body copy block):
- The breathing circle stops (static)
- Headline copy changes to: `"Something didn't quite work."`
- Body copy changes to: `"It happens. Tap below to try again — your answers are safe."`
- A `Button`, `variant="primary"`, label `"Try again"` appears below the body copy, `marginTop: spacing.s8`
  - On press: re-POST the same answers to `/score-ocean-profile`
- `accessibilityRole="alert"` on the body copy view to announce the error to screen readers

### Accessibility
- The animated circle: `accessibilityElementsHidden={true}` — it's decorative
- Headline: `accessibilityRole="header"`
- Status region: `accessibilityLiveRegion="polite"` on a wrapper — if the copy changes from loading to error, screen readers announce the new text

---

## Screen 4 — Complete (`(onboarding)/complete.tsx`)

### User goal
Feel welcomed into the app. Understand that the setup is done and the experience is now personal.

### Visual layout

**Background**: Same linear gradient as welcome and scoring screens (consistent trio). The gradient here is slightly more saturated toward the top — achieved by the natural rendering of `primaryContainer` → `surface`, which is the same gradient as the welcome screen. No changes needed.

**Layout**: `SafeAreaView`, `flex: 1`, `justifyContent: "center"`, `paddingHorizontal: spacing.s8`.

**Content** (top to bottom):

1. **Celebration mark** — `marginTop: spacing.s20` from top safe area
   - A `Card`, `variant="elevated"`, `width: 80pt`, `height: 80pt`, `borderRadius: radius.xl` (32pt), background `colors.primaryContainer`, `alignSelf: "flex-start"` (left-aligned for intentional asymmetry)
   - Inside: `Ionicons leaf-outline` icon, 36pt, `colors.primary`, centered within the card
   - The asymmetric left-alignment of this small card against the wide right margin creates a high-end editorial tension — a mark of arrival, not a trophy
   - `marginBottom: spacing.s8` (32pt)
   - Entrance animation: scale from `0.8` to `1.0`, 400ms, `animation.springConfig`. `prefers-reduced-motion`: instant appear.

2. **Headline** — `typography.displayLg` (Manrope Bold, 56pt), `colors.onSurface`
   - Copy: `"Your sanctuary is ready."`
   - Left-aligned. `lineHeight: 64`. Occupies ~80% viewport width (the remaining 20% is parchment margin — a classic editorial moment).
   - `marginBottom: spacing.s6` (24pt)

3. **Body copy** — `typography.bodyLg`, `colors.secondary`, `lineHeight: 26`
   - Copy: `"From here, your morning messages, your thoughts, and your reflections will all carry a little more of you."`
   - Left-aligned, `marginBottom: spacing.s16` (64pt)

4. **Primary CTA** — `Button`, `variant="primary"`, full border radius
   - Label: `"Begin your first capture"`
   - `width: "100%"`
   - On press: triggers completion actions then navigates
     - `AsyncStorage.setItem('sanctuary:onboarding_complete:<userId>', 'true')`
     - Schedule daily morning notification (`DailyTriggerInput` at `morning_notification_time`)
     - `router.replace('/(app)')` — replaces the entire onboarding stack
   - `accessibilityRole="button"`, `accessibilityLabel="Begin your first capture and enter the app"`

5. **Secondary note** — `marginTop: spacing.s4`, below CTA
   - Copy: `"You can update your preferences at any time in Settings."` — `typography.labelMd`, `colors.outlineVariant`, `textAlign: "center"`

**Bottom safe-area buffer**: `paddingBottom: spacing.s12`

### Behaviour

```
Step 1: Screen mounts → AsyncStorage flag set + daily notification scheduled (fire-and-forget, non-blocking)
Step 2: User reads the completion screen (no minimum dwell time required)
Step 3: User taps "Begin your first capture"
  → router.replace('/(app)') — no back navigation into onboarding
Edge case: AsyncStorage write or notification scheduling fails: swallow error silently (not user-facing; the route guard will re-check ocean_profiles next time). Log to console.debug only.
```

### Accessibility
- Celebration card: `accessibilityElementsHidden={true}` (decorative)
- Headline: `accessibilityRole="header"`
- CTA: standard button accessibility

---

## Component — Morning Message Card (`MorningMessageCard`)

### Context

The `MorningMessageCard` is rendered on the Quick Capture home screen (`src/app/(app)/index.tsx`) within the **morning window**: when local time ≥ `morning_notification_time` preference AND local time < 12:00 noon. It sits above the capture controls — in the vertical flow of the screen, above the hero capture area.

### Placement in the Quick Capture screen

The Quick Capture screen currently has (from top to bottom):
1. Header row (brand mark + settings affordance)
2. Hero copy ("Speak your mind.")
3. Voice control (large circular button with pulse ring)
4. Text capture field + "Capture" CTA
5. Recent Thoughts row

The `MorningMessageCard` inserts **between the header row and the hero copy** (position 1.5), appearing only during the morning window. It does not replace or displace the hero — it adds to the screen, pushing content down slightly. On small screens (320pt), the card is compact by design to avoid overwhelming the capture interface.

**Placement rationale**: The morning message is a greeting, not a capture prompt. It should be seen first — before the user reaches for the microphone — but it should not be the primary action. Positioning it above the hero but below the header gives it prominence without claiming the screen.

### Card visual spec

```
Component: MorningMessageCard
States: loading | default (message shown) | dismissed | error
```

**Container**:
- `Card` component, `variant="elevated"`
- Background: `colors.surfaceContainerLowest` (`#ffffff`)
- `borderRadius: radius.xl` (32pt)
- `padding: spacing.s6` (24pt)
- `marginHorizontal: spacing.s8` (32pt — aligned with screen global padding)
- `marginTop: spacing.s4` (16pt below header row)
- `marginBottom: spacing.s6` (24pt above hero copy)
- Ambient shadow: `shadows.card`
- `minHeight: 80pt` (loading/short messages)
- `maxHeight: 200pt` (long messages; content clips with a soft bottom fade, see below)

**Card top row**:
- Left: `"This morning"` label — `typography.labelMd` (12pt), `colors.outlineVariant`, `letterSpacing: 0.5`
- Right: Dismiss affordance — `Ionicons close-outline` icon, 18pt, `colors.outlineVariant`, wrapped in a 36×36pt `Pressable` (`borderRadius: radius.full`, pressed state `colors.surfaceContainerHigh`)
- `flexDirection: "row"`, `justifyContent: "space-between"`, `alignItems: "center"`, `marginBottom: spacing.s4` (16pt)

**Message body** (default state):
- Message text — `typography.bodyLg` (Plus Jakarta Sans 16pt), `colors.onSurface`, `lineHeight: 26`
- Left-aligned
- If message text exceeds `maxHeight` after the top row: clip with a `LinearGradient` overlay at the bottom (`colors.surfaceContainerLowest` at 0% → 100% over 32pt), visually fading the last line into the card background. This signals overflow without a hard cutoff.

**Card bottom accent** (below message body):
- A thin strip: `height: 2pt`, `borderRadius: radius.full`, `backgroundColor: colors.primaryContainer` (`#d7e7d3`), `width: 40pt`
- `alignSelf: "flex-start"`, `marginTop: spacing.s4`
- This small sage underline is the only brand colour visible on the card — a quiet signature confirming this message is personalised

### Loading state

Shown while `generate-morning-message` API call is in flight (< 300ms loads use skeleton only; card mounts immediately).

- Top row: same (`"This morning"` + dismiss affordance)
- Message area: skeleton loader — two `View` bars, stacked
  - Bar 1: `width: "90%"`, `height: 16pt`, `borderRadius: radius.sm`, `backgroundColor: colors.surfaceContainerHigh`, `opacity: 0.7`
  - Bar 2 (below, `marginTop: 8pt`): `width: "60%"`, same height and style
  - Skeleton shimmer: `opacity` oscillates between `0.4` and `0.8`, 1200ms cycle (ease-in-out loop)
  - `prefers-reduced-motion`: static bars, no shimmer
- Bottom accent: shown as a skeleton bar as well (`width: 40pt`, same height as the accent strip)

### Dismissed state

When the user taps the dismiss (X) icon, the card slides up and fades out simultaneously:
- `translateY`: `0` → `-24pt`, `opacity`: `1` → `0`, 250ms, ease-in
- After animation, card unmounts (`null` return). The hero copy below rises to fill the gap with the same 250ms transition (via `LayoutAnimation.easeInEaseOut()`).
- `prefers-reduced-motion` fallback: instant unmount, no animation.
- Dismissal is **session-only** — the card returns if the user closes and re-opens the app within the morning window. `shown_at` is set in `morning_messages` on first render, but dismissal is not persisted (per ADR-005 architecture).

### Error state

Shown if the API call fails (network error, 4xx, 5xx).

- Top row: same
- Message area: body text `"Your morning message couldn't load."` — `typography.bodyLg`, `colors.onSurfaceVariant`
- Below body: a `Pressable` row: `"Try again"` text in `PlusJakartaSans_600SemiBold`, 14pt, `colors.primary`, `paddingVertical: spacing.s4` touch target, `marginTop: spacing.s2`
  - On press: retry the `generate-morning-message` call → transition to loading state → then default state on success
- Error: `accessibilityRole="alert"` on the message area view to announce to screen readers

### Daily cache behaviour (visible to user)

The card renders the same message all morning — from `morning_notification_time` until noon. If the user opens the app at 7:30 AM, reads the card, dismisses it, then reopens at 9:45 AM, the card renders again (because the dismissal was session-only) with the **same cached message** (from `morning_messages` table where `generated_for_date = today` — the message already exists, no new API call). This provides consistency: the morning message is a stable companion, not a slot-machine.

The user never sees this caching logic — it is invisible by design.

### Component spec summary

```
Component: MorningMessageCard
Props:
  onDismiss: () => void       — called after dismiss animation completes
  messageText?: string        — message to display (undefined = loading state)
  isLoading: boolean          — show skeleton when true
  hasError: boolean           — show error state
  onRetry: () => void         — called when "Try again" is pressed in error state

States:
  loading   — skeleton bars, shimmer
  default   — message text, dismiss affordance, bottom accent
  error     — error copy, retry affordance
  dismissed — animates out, then renders null

Responsive behaviour:
  320pt  — full width minus 2× spacing.s8 margins; message body max 3 lines before fade
  768pt  — same margins apply; card will feel narrower relative to screen (centred)
  1280pt — not applicable (mobile-only; Expo/React Native target)

Accessibility:
  Container: role="article", accessibilityLabel="Your morning message"
  Dismiss button: accessibilityRole="button", accessibilityLabel="Dismiss morning message"
  Message text: accessibilityRole="text"
  Retry button: accessibilityRole="button", accessibilityLabel="Retry loading morning message"
  Loading state: accessibilityLabel="Loading your morning message", accessibilityLiveRegion="polite"
  Error state: role="alert" to announce automatically

Motion:
  Dismiss: translateY(0→-24pt) + opacity(1→0), 250ms ease-in; LayoutAnimation for content below
  Loading shimmer: opacity oscillates 0.4↔0.8, 1200ms ease-in-out loop
  prefers-reduced-motion: no animate-out (instant unmount), no shimmer
```

---

## Icon system recommendation

**Chosen system**: `@expo/vector-icons` → `Ionicons` (already in project per existing reminders spec)

**Style variant**: Outline for passive/decorative, Filled for active/selected states. This is consistent with the existing `notifications-outline` / `notifications` (filled) pattern in the reminders feature.

**Sizing grid**: 16pt (inline metadata), 18pt (card affordances), 24pt (navigation), 32pt+ (hero/illustration use)

**Specific icons used in this spec**:
| Usage | Icon | Style | Size |
|---|---|---|---|
| Stepper back navigation | `arrow-back` | filled | 24pt |
| Optional question marker | `sparkles-outline` | outline | 32pt |
| Completion mark | `leaf-outline` | outline | 36pt |
| Morning message dismiss | `close-outline` | outline | 18pt |
| Morning message retry | none (text-only) | — | — |

---

## Flow transitions (cross-screen)

| Transition | Animation | Duration | Reduced-motion |
|---|---|---|---|
| Welcome → Questions | Horizontal slide (push right) | 350ms | Cross-fade 250ms |
| Q-to-Q forward | Horizontal slide (push left) | 250ms | Cross-fade 150ms |
| Q-to-Q backward | Horizontal slide (push right) | 250ms | Cross-fade 150ms |
| Questions → Optional transition card | Cross-fade (in-place) | 300ms | Instant |
| Questions → Scoring | Horizontal slide (push left) | 350ms | Cross-fade 250ms |
| Scoring → Complete | Horizontal slide (push left) | 350ms | Cross-fade 250ms |
| Complete → App | Replace (no slide — whole stack replaced) | Native | Native |

All slide animations: `cubic-bezier(0.4, 0, 0.2, 1)` easing.

---

## Handoff notes for @react-native-developer

### Data passing between screens

The simplest implementation: collect answers in a local array in `questions.tsx` state. On navigating to `scoring.tsx`, pass the answers array via navigation params (Expo Router `router.push('/(onboarding)/scoring', { params: { answers: JSON.stringify(answersArray) } })`). The scoring screen parses and POSTs. No shared context or global state is needed for this one-shot flow.

Alternatively, a lightweight React context scoped to the `(onboarding)` route group can hold the answers array if passing large JSON through route params is undesirable.

### TextInput keyboard avoidance

On both iOS and Android, `KeyboardAvoidingView` should wrap the question screen content. On iOS, `behavior="padding"` offsets the view so the TextInput and navigation row remain visible above the keyboard. The question card may scroll partially out of view on small screens (320pt) with a tall keyboard — this is acceptable; the TextInput and navigation row are the critical elements that must remain visible.

### Screen transition configuration

In `src/app/(onboarding)/_layout.tsx`, configure the Stack navigator with custom animation (horizontal slide) for the question flow. Use `animation: "slide_from_right"` (Expo Router's built-in) for forward navigation and `animation: "slide_from_left"` for back — or implement custom shared element transitions if the developer prefers a React Native Reanimated approach.

### Notification permission

Request notification permission at the `complete.tsx` step, just before scheduling the daily morning notification. If permission is denied, proceed without scheduling — the morning message card on the Quick Capture screen will still work (it shows without a push notification; the user will see it when they open the app during the morning window). Do not block completion on permission denial.

### Existing components to reuse

| Element | Reuse |
|---|---|
| `Button` | `variant="primary"` for all CTAs; `variant="secondary"` for Skip / Close where needed |
| `Card` | `variant="elevated"` for question card and morning message card |
| `TextInput` | Base component; extend with `multiline` and `minHeight` props |

### No new tokens

Every colour, spacing value, radius, shadow, and font used in this spec is drawn from the existing `src/lib/theme.ts` export. @react-native-developer must not introduce new style constants — use named token imports only.

---

## Open questions for @react-native-developer

1. **Answer passing to scoring screen**: Prefer route params (JSON.stringify) or a scoped context? Choose based on Expo Router v6 param size limits — confirm with @systems-architect if large answers arrays risk URL truncation on Android deep-link routing.
2. **`KeyboardAvoidingView` strategy**: On Android, `behavior="height"` (not `"padding"`) may be required for reliable keyboard avoidance in the question screen. Test on both platforms.
3. **Morning message timing check**: The "morning window" logic (`morning_notification_time ≤ now < 12:00`) should use the user's local time zone (from `user_preferences.morning_notification_time` + device timezone). Confirm with @backend-developer that `morning_notification_time` is stored as an `"HH:MM"` string in 24-hour local time (consistent with the reminders spec — it is, per `user_preferences` schema).

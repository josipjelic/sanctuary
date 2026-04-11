<!--
DOCUMENT METADATA
Owner: @systems-architect (all sections except Design System)
Update trigger: System architecture changes, new integrations, component additions, design system updates
Update scope:
  @systems-architect: All sections except "Design System"
  @ui-ux-designer: "Design System" section only
  @react-native-developer: May append to "Mobile Architecture" (never overwrite)
  @backend-developer: May append to "Backend Architecture" (never overwrite)
Read by: All agents. Always read before making implementation decisions.
-->

# System Architecture

> Last updated: 2026-04-11 (Journal subsystem: ADR-006; OCEAN onboarding & morning messages: ADR-005; Supabase deploy GitHub Action; Lists subsystem planned: tasks #029–#036; Reminders subsystem: ADR-004; AI I/O observability: ADR-003)
> Version: 0.1.0

---

## Product deltas (vs PRD.md)

PRD v1.1 documents user-scoped topics and the transcribe/assign-topics pipeline. The following implementation notes remain for agents (ADR-002, `docs/technical/API.md`):

- User-facing vocabulary is **topics** (not “tags”): each user has a `user_topics` catalog; each thought has **one primary topic** assigned by AI.
- Topic assignment reuses an existing topic only when the model reports `best_match_score` **>** **0.2**; otherwise a new catalog row is created (see ADR-002).
- **Voice**: `/transcribe` writes the transcript then runs topic assignment in the same edge invocation (no separate client call).
- **Text**: `/assign-topics` runs the same shared logic after insert.
- **Reminders** (ADR-004): AI detects future time references in thought text after topic assignment (fire-and-forget, non-blocking). Detected reminders are stored as **`inactive`** rows in `reminders` until the user approves or dismisses. Approved rows become **`active`** with a client-scheduled local notification via `expo-notifications` — no server-side scheduler in v1. PRD v1.0 section 7 listed reminders as out-of-scope; the product owner explicitly directed this addition.
- **OCEAN onboarding & morning messages** (ADR-005): After sign-up, users answer 5–7 reflective questions. A `score-ocean-profile` edge function scores their answers against the OCEAN (Big Five) model via OpenRouter and stores the profile in `ocean_profiles`. Each morning, a `generate-morning-message` edge function produces a personalised message from the profile; a recurring daily local notification nudges the user to open the app; an in-app card on the Quick Capture screen shows the generated message. Onboarding completion is gated via a route guard in the root layout, held behind the Expo splash screen to avoid flash.
- **Lists** (tasks #029–#036, planned): AI detects whether a captured thought is primarily a list (shopping, tasks, ideas, etc.) — fire-and-forget after topic assignment, same pattern as reminders. Detected lists create `user_lists` + `list_items` rows. The AI also detects **continuation** — when a new thought references an existing list title, new items are appended rather than creating a duplicate list. Each item can be marked done in the UI; marking all items done closes the list. ADR-005 pending architecture wave.
- **AI-Guided Journal** (ADR-006, tasks #043–#049, planned): A conversational reflection session (up to 3 turns) with a fixed opening question and up to 2 AI-generated follow-ups. Session data persists incrementally to `journal_sessions` + `journal_entries`. A fire-and-forget user state update after each session maintains a ~200-word analysis (`user_state`) used as context for future sessions. Evening reminder follows the ADR-005 morning notification pattern (`DailyTriggerInput`, default 21:00). Journal history is a separate screen from the Thoughts inbox.

---

## Overview

Sanctuary is a React Native mobile application (built with Expo) backed by Supabase as a managed backend-as-a-service. The mobile app communicates directly with Supabase for authentication, database reads/writes, and edge function invocation. **Voice audio is not stored in Supabase Storage** in v1 — recordings are sent as multipart uploads to the `transcribe` function and discarded after processing. AI capabilities (transcription and topic assignment) run in Supabase Edge Functions that proxy to OpenRouter, keeping API credentials server-side.

The architecture prioritizes simplicity and fast iteration: there is no custom API server. All business logic runs either in the mobile app or in Supabase Edge Functions. Row Level Security (RLS) on all Supabase tables ensures each user can only access their own data.

```
+------------------------------------------+
|         Expo / React Native App           |
|                                           |
|  screens/  hooks/  components/  lib/      |
+------------------+-----------------------+
                   |
                   |  Supabase JS Client
                   |  (auth, db, storage, functions)
                   v
+------------------------------------------+
|              Supabase                     |
|                                           |
|  Auth  |  PostgreSQL  |  Storage (unused for voice in v1) |
|                                           |
|  Edge Functions                           |
|    +-- transcribe (voice -> text + topics)|
|    +-- assign-topics (text -> topics)     |
|    +-- detect-reminders (fire-and-forget) |
|    +-- detect-list (fire-and-forget, planned)|
|    +-- score-ocean-profile (onboarding)   |
|    +-- generate-morning-message (daily)   |
|    +-- journal-next-question (journal AI) |
|    +-- journal-save-session (journal save)|
+------------------+-----------------------+
                   |
                   |  OpenRouter API
                   v
+------------------------------------------+
|              OpenRouter                   |
|  (model-flexible AI proxy)                |
|  - Whisper / Groq for transcription       |
|  - Claude / GPT for topics + prompts      |
+------------------------------------------+
```

**Key relationships**:
- Mobile app <-> Supabase: via `@supabase/supabase-js` client using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Supabase Edge Functions <-> OpenRouter: server-side only, using `OPENROUTER_API_KEY` (never exposed client-side)
- All database tables use RLS: users access only rows where `user_id = auth.uid()`

---

## Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Mobile framework | Expo | SDK 54 (stable) | Cross-platform React Native with managed workflow; aligns with store Expo Go |
| Language | TypeScript | 5.x | Type safety across app and shared types |
| Navigation | Expo Router | 6.x | File-based routing, deep linking support |
| Voice recording | expo-audio | SDK-bundled | Quick Capture microphone recording (`expo-av` removed; SDK 54 deprecates AV). `patches/expo-audio@1.1.1.patch` adjusts iOS permission checks and drops `AVEncoderBitRateKey` for AAC so `prepareToRecord` does not hit `AudioCodecInitialize` failures when quality is also set. |
| Local notifications | expo-notifications | SDK-bundled | Reminder scheduling via `scheduleNotificationAsync`; handles APNs/FCM registration (ADR-004) |
| Backend-as-a-service | Supabase | Latest | Auth, PostgreSQL, storage, edge functions — no custom server needed |
| Database | PostgreSQL | 15 (managed by Supabase) | Relational, RLS support, well-understood |
| AI proxy | OpenRouter | Latest | Model-flexible — swap transcription/tagging models without code changes |
| State management | React Context + local `useState` | — | Task #004 delivered the design system only; `AuthContext` holds session; screens load Supabase data in component state / effects — no Zustand or React Query yet |
| Formatter + Linter | Biome | Latest | All-in-one, fast |
| Unit tests | Jest | 29.x | Standard for React Native |

---

## Infrastructure Environments

| Environment | Mobile | Database | Edge Functions |
|-------------|--------|----------|----------------|
| Local / Dev | Expo Go or simulator | Supabase dev project | Supabase CLI local or remote dev project |
| Production | App Store / Play Store (EAS Build) | Supabase production project | Supabase production edge functions |

---

## Design System

> This section is owned by @ui-ux-designer. See `.assets/DESIGN.md` for the full specification.

The design system is codified as "The Serene Interface" — a high-end editorial aesthetic built around breathtaking whitespace and intentional asymmetry. Key design tokens:

- **Primary (Sage)**: `#536253`
- **Surface (Parchment)**: `#f9f9f8`
- **Typography**: Manrope (display/headlines) + Plus Jakarta Sans (body/labels)
- **No border lines** — separation via background color shifts only
- **Corner radius**: `xl` (3rem) or `lg` (2rem) for all cards

Full token set and component specs implemented in task #004.

### Implementation (added by @frontend-developer, task #004)

The design tokens and base component library are implemented as of 2026-03-28:

**Token file**: `src/lib/theme.ts`
Exports `colors`, `typography`, `shadows`, `spacing`, `radius`, and `animation` as typed `const` objects. Import individual token groups — e.g., `import { colors, spacing } from '@/lib/theme'`.

**Base components** (`src/components/`):

| Component | File | Description |
|-----------|------|-------------|
| `Button` | `Button.tsx` | Primary (`#536253`) and secondary (`#dae4e9`) variants, full border radius, `activeOpacity: 0.9` (no darkening on press) |
| `Card` | `Card.tsx` | `lg` (24pt) or `xl` (32pt) radius; `elevated` variant applies ambient shadow (`4% opacity, 32px blur`); no border lines |
| `TextInput` | `TextInput.tsx` | `surfaceContainerHigh` background, ghost border focus ring (`primary` at 20% opacity), no bottom line |
| `Topic` | `Topic.tsx` | Pill-shaped chip for the thought’s primary topic |
| `ThoughtListCard` | `ThoughtListCard.tsx` | Inbox / Library list row — body preview, topic chips, relative time |
| `TopicFolderCard` | `TopicFolderCard.tsx` | Library index “folder” tile (see `.assets/library_lists/code.html`) |

**Barrel export**: `src/components/index.ts` — import any component with `import { Button, Card, TextInput, ThoughtListCard, Topic, TopicFolderCard } from '@/components'`.

**Fonts**: Manrope (400/600/700) and Plus Jakarta Sans (400/600) loaded via `@expo-google-fonts/manrope` and `@expo-google-fonts/plus-jakarta-sans`. Font loading and splash screen management live in `src/app/_layout.tsx`.

### Reminders feature surfaces (task #023, @ui-ux-designer)

Full spec: `.assets/reminders-ux-spec.md`. Summary of new and modified surfaces:

**Modified components**:

| Component | File | Change |
|-----------|------|--------|
| `ThoughtListCard` | `ThoughtListCard.tsx` | New optional props: `hasPendingReminder`, `hasApprovedReminder`, `onBellPress`. Bell icon (`Ionicons notifications-outline` / `notifications`, 16pt) added to timestamp row trailing edge. Pending = `colors.primary`; approved = `colors.outlineVariant`; dismissed = no icon. |

**New components**:

| Component | File | Description |
|-----------|------|-------------|
| `ReminderApprovalSheet` | `ReminderApprovalSheet.tsx` | Bottom sheet `Modal` (`radius.xl` top corners, `surfaceContainerLowest` background, `maxHeight: "85%"`). Contains scrollable list of pending reminders; each item shows extracted title (italic `bodyLg` on `surfaceContainerHigh` tinted block), editable date+time row (taps native DateTimePicker), and Approve / Dismiss `Button` pair. Empty state: checkmark icon + "All caught up" heading + Close button. |
| Pending-reminders pill | Inline in `inbox/index.tsx` | `Pressable` pill above `FlatList`. Background `colors.primaryContainer`, text `colors.onPrimaryContainer`, `radius.full`. Hidden when count = 0. Opens `ReminderApprovalSheet`. |

**Settings additions** (in existing Settings `Modal` in `src/app/(app)/index.tsx`):
- "Reminders" section label (`labelMd`, `outlineVariant`, `accessibilityRole="header"`) with a `surfaceContainerHigh` hairline separator above it.
- Lead-time selector row (matches `settingsLanguageRow` pattern): options "At the time", "15 minutes before" (default), "30 minutes before", "1 hour before", "In the morning". Opens a picker sheet matching the language picker pattern.
- Morning time row (conditional, shown only when "In the morning" is selected): taps native time picker. Default `07:30`. Animated show/hide via `LayoutAnimation` (300ms); instant when `prefers-reduced-motion` is enabled.

**No new design tokens** are introduced by this feature. All values are drawn from the existing `src/lib/theme.ts` token set.

### OCEAN onboarding & morning messages (task #038, @ui-ux-designer)

Full spec: `.assets/onboarding-ocean-ux-spec.md`. Summary of new surfaces:

**New components**:

| Component | File | Description |
|-----------|------|-------------|
| `OnboardingProgressStepper` | Inline in `(onboarding)/questions.tsx` | Horizontal row of 7 dots (5 primary + 2 optional). Active dot: `24×8pt` pill, `colors.primary`. Completed dot: `8×8pt` circle, `colors.primary` at 50% opacity. Upcoming dot: `8×8pt` circle, `colors.outlineVariant`. Optional dots (6–7): same sizing as upcoming/completed but `opacity: 0.4`. Active dot morphs from circle to pill via `LayoutAnimation` (150ms ease-out; `prefers-reduced-motion`: instant). The stepper row carries a single `accessibilityLabel` announcing current position (e.g. `"Question 2 of 5"`); individual dots are `accessibilityElementsHidden={true}`. |
| `QuestionCard` | Inline in `(onboarding)/questions.tsx` | `Card` component (`variant="elevated"`, `radius.lg` / 24pt, `padding: spacing.s8`, ambient `shadows.card`). Contains: (1) question number label (`typography.labelMd`, `colors.outlineVariant`), (2) question text (`typography.headlineMd`, `colors.onSurface`), (3) hint text `"Write as much or as little as feels right."` (`typography.labelMd`, `colors.secondary`). Slides in/out horizontally on question advance (250ms, `cubic-bezier(0.4,0,0.2,1)`; cross-fade under `prefers-reduced-motion`). Question text `TextInput` rendered adjacent (not inside card): `multiline`, `minHeight: 120pt`, `maxHeight: 240pt`, `colors.surfaceContainerLow` background, `radius.lg`. Character count hint shown when focused (`typography.labelMd`, `colors.outlineVariant`). |
| `MorningMessageCard` | `src/components/MorningMessageCard.tsx` | `Card` component (`variant="elevated"`, `radius.xl` / 32pt, `padding: spacing.s6`, ambient `shadows.card`). Rendered on Quick Capture screen between the header row and hero copy, during morning window only (`morning_notification_time ≤ local time < 12:00`). Top row: `"This morning"` label (`typography.labelMd`, `colors.outlineVariant`) + dismiss icon (`Ionicons close-outline`, 18pt, `colors.outlineVariant`, 36×36pt `Pressable`). Message body: `typography.bodyLg`, `colors.onSurface`; content above `maxHeight: 200pt` fades with a `LinearGradient` overlay. Bottom accent: 2pt × 40pt sage strip (`colors.primaryContainer`, `radius.full`). **Loading state**: skeleton bars (two `View` blocks, `colors.surfaceContainerHigh`, shimmer opacity 0.4↔0.8 loop at 1200ms; `prefers-reduced-motion`: static). **Error state**: `"Your morning message couldn't load."` copy + `"Try again"` text pressable (`colors.primary`). **Dismiss**: `translateY(0→-24pt)` + `opacity(1→0)`, 250ms ease-in, session-only (not persisted). Props: `messageText?: string`, `isLoading: boolean`, `hasError: boolean`, `onDismiss: () => void`, `onRetry: () => void`. |

**No new design tokens** are introduced by this feature. All values are drawn from the existing `src/lib/theme.ts` token set.

---

## Mobile Architecture

> Last updated: 2026-03-29 — Quick Capture aligned to `.assets/quick_capture_home`

### Folder Structure

```
src/
  app/
    _layout.tsx       # Root: fonts, splash, AuthProvider, Stack (auth + app groups)
    (auth)/           # sign-in, sign-up, forgot-password
    (app)/            # Authenticated tabs: Capture, Thoughts (inbox), Library
      _layout.tsx     # Tab navigator
      index.tsx       # Quick Capture (Capture tab)
      inbox/          # Stack: list + [thoughtId] thought detail (modal)
      library/        # Stack: topic grid + [topicId] thought list
  components/       # Shared UI (Button, Card, Topic, ThoughtListCard, …)
  contexts/         # AuthContext (session + signOut)
  hooks/            # useAuth, etc.
  lib/              # supabase.ts, theme.ts, capture.ts, logger, …
  types/            # thought.ts, thoughtList.ts, …
assets/             # Static images, icons (fonts loaded via Google Fonts packages)
```

**E2E tests**: Intended location is `tests/e2e/` at the repo root (see TODO #013–#014). That directory and `pnpm run test:e2e` are **not** set up yet.

**Unit tests**: Jest, colocated as `*.test.ts` / `*.test.tsx` next to sources (see `package.json` `pnpm test`).

### Navigation

Navigation is handled by **Expo Router v6** using file-based routing. The `src/app/` directory is the route root.

- `src/app/_layout.tsx` — Root layout: font loading, splash screen, `AuthProvider`, and a root `<Stack>` with `headerShown: false`. Imports the URL polyfill (`react-native-url-polyfill/auto`) in the same module tree as the Supabase client.
- `src/app/(auth)/` — Unauthenticated stack (sign-in, sign-up, forgot password).
- `src/app/(app)/_layout.tsx` — After login, a **tab** navigator with **Capture**, **Thoughts**, and **Library**.
- `src/app/(app)/inbox/_layout.tsx` — Nested stack: inbox list → `inbox/[thoughtId]` (thought detail as a modal).
- Route params (e.g. `thoughtId`, `topicId`) are typed inline with `useLocalSearchParams` at each screen — there is no separate `src/navigation/types.ts`.

Deep linking is configured via `app.json` (`scheme: "sanctuary"`) and the `expo-router` plugin.

#### Quick Capture (home tab)

- **Design reference**: `.assets/quick_capture_home/code.html` (and `screen.png`) — header with brand mark and settings affordance, hero “Speak your mind.” / “Your thoughts are safe here.”, large primary voice control with soft glow and pulse ring, typed capture in a tonal field with pill **Capture** CTA, **Recent Thoughts** row to the inbox (subtitle shows today’s capture count).
- **Implementation**: `src/app/(app)/index.tsx` — registered as the first tab in `(app)/_layout.tsx`.

#### Library (topics)

- **Design reference**: `.assets/library_lists/code.html` — editorial header, **Manage lists** CTA, folder-style topic cards (one topic per row; asset mockup uses a wider bento grid), reflection footer.
- **Tab + stack**: `src/app/(app)/_layout.tsx` registers a **Library** tab. `src/app/(app)/library/_layout.tsx` is a nested `<Stack>`: `library/index.tsx` (topic grid) → `library/[topicId].tsx` (thoughts whose denormalized `thoughts.topics` array contains that catalog topic’s `name`).
- **Data**: Topics load from `user_topics` (ordered by `name`). Per-topic thought counts aggregate client-side from `thoughts.topics`. **Add topic** inserts into `user_topics` using `src/lib/normalizeTopicLabel.ts`, kept in sync with `supabase/functions/_shared/assign-topics.ts`.
- **Deferred vs PRD**: “All thoughts” library filter and **daily check-in history** ([FR-042](PRD.md)) are not implemented on this screen yet.

#### Thoughts (inbox) and detail

- **Inbox**: `src/app/(app)/inbox/index.tsx` — paginated list of thoughts, pull-to-refresh; tap opens detail.
- **Detail (minimal)**: `src/app/(app)/inbox/[thoughtId].tsx` — full body, read-only topic chips, manual edit/save for `body`, delete with confirmation. Journaling (`body_extended`), debounced auto-save, reflection prompt, and full Reflection Space UI are **backlog** (TODO #010 — see `.tasks/010-thought-detail-screen.md`).

### Supabase Client

The Supabase JS client is initialized in `src/lib/supabase.ts` as a module-level singleton. Key configuration:

- **Storage**: `AsyncStorage` from `@react-native-async-storage/async-storage` — persists the auth session across app restarts.
- **autoRefreshToken**: `true` — the client automatically refreshes expiring JWTs.
- **detectSessionInUrl**: `false` — disabled because React Native does not use URL-based OAuth callbacks the same way as web apps.
- **Environment variables**: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are read at module initialization. The client throws a descriptive error at startup if either variable is missing, preventing silent failures in misconfigured environments.

### State Management

- **Global auth**: `src/contexts/AuthContext.tsx` + `useAuth()` — Supabase session, loading state, and `signOut`.
- **Server-backed UI**: Each screen loads data with the Supabase client (`useEffect`, `useFocusEffect`, or callbacks) and holds rows in local `useState`. There is **no** React Query or SWR in the tree yet.
- **Local UI**: Forms, modals, and recording state use `useState` / `useRef` as usual.

Optional future additions (Zustand, TanStack Query) should be recorded in a new ADR if adopted.

---

## Backend Architecture

> Last updated: 2026-03-30 — observability contract (ADR-003); edge inventory 2026-03-28 (task #003)

### Edge Function Inventory

All edge functions are deployed to Supabase and live under `supabase/functions/`. They are invoked by the mobile app via `supabase.functions.invoke()`, which automatically injects the user's session token as a Bearer header.

| Function | Method | Description | Status |
|----------|--------|-------------|--------|
| `transcribe` | POST | Multipart audio → OpenRouter transcription → `thoughts.body`, then shared topic assignment (`_shared/assign-topics.ts`) | Implemented |
| `assign-topics` | POST | JSON `thought_id` + `text` → same shared topic assignment (typed capture) | Implemented |
| `detect-reminders` | POST | JSON `thought_id` + `text` (+ optional `current_iso_timestamp`) → AI extraction → zero or more `inactive` `reminders` rows | Implemented — shared `_shared/detect-reminders.ts` invoked fire-and-forget from `transcribe` and `assign-topics`; same module backs this standalone endpoint |
| `detect-list` | POST | JSON `thought_id` + `text` → AI detection of list intent + item extraction + continuation matching against existing `user_lists` titles → `user_lists` + `list_items` rows | Planned — tasks #029–#036; shared `_shared/detect-list.ts` invoked fire-and-forget from `transcribe` and `assign-topics` |
| `reflection-prompt` | POST | Receives thought text, returns an AI-generated reflection question — does not persist to DB | Planned — task #010 |
| `score-ocean-profile` | POST | JSON `{ answers: [{ question, answer }] }` → OpenRouter OCEAN scoring → `ocean_profiles` upsert | Planned — tasks #038–#039 (ADR-005) |
| `generate-morning-message` | POST | No body (reads caller's `ocean_profiles` row) → OpenRouter message generation → `morning_messages` insert → returns `message_text` | Planned — tasks #040–#041 (ADR-005) |
| `journal-next-question` | POST | JSON `{ session_id, turns, user_state_snapshot? }` → OpenRouter generates next question or `{ done: true }` signal; enforces 3-turn max server-side → returns `{ question, turn_index }` or `{ done: true }` | Planned — tasks #044–#046 (ADR-006) |
| `journal-save-session` | POST | JSON `{ session_id }` → marks session `completed`; fire-and-forget incremental merge of new session into `user_state` via OpenRouter → returns `{ session_id, saved_at }` | Planned — tasks #044–#046 (ADR-006) |

All edge functions:
- Require a valid Supabase session token on `POST` (`getUser()` with anon client + user JWT)
- Perform database writes with the user-scoped Supabase client so **RLS** applies (no service role in current topic/transcribe paths)
- Access `OPENROUTER_API_KEY` via Supabase project secrets — this key is never present in the mobile app bundle

**Adding a new edge function**: create `supabase/functions/<name>/index.ts`, deploy with `supabase functions deploy <name>`, and set any required secrets with `supabase secrets set KEY=value`.

### RLS Policy Patterns

Row Level Security is enabled on all user-data tables. The pattern is uniform across all tables:

| Operation | Policy expression |
|-----------|-------------------|
| SELECT | `USING (user_id = auth.uid())` |
| INSERT | `WITH CHECK (user_id = auth.uid())` |
| UPDATE | `USING (user_id = auth.uid())` |
| DELETE | `USING (user_id = auth.uid())` |

Key rules:
- The `user_id` column on every table is a `uuid` foreign key to `auth.users.id` with `ON DELETE CASCADE`.
- INSERT policies use `WITH CHECK` (not `USING`) — this is a Supabase requirement for insert-time enforcement.
- **Edge functions `transcribe` and `assign-topics`** create a Supabase client with the **anon key** and forward the caller’s **`Authorization: Bearer <user_jwt>`** header. Database writes run **under the user’s identity**, so **RLS applies** — there is no service role on these paths in the current codebase. If a future function must bypass RLS (e.g. admin jobs), use the service role only in that function and document it here.
- The anon key used by the mobile app is safe to ship — it cannot bypass RLS without a valid user JWT for permitted rows.

### Auth Configuration

Auth is handled entirely by Supabase Auth (email + password). There is no custom auth server.

**Session lifecycle**:
- Sessions are stored in `AsyncStorage` (via the Supabase JS client config in `src/lib/supabase.ts`)
- `autoRefreshToken: true` — the client refreshes the JWT silently before expiry (1-hour JWT, refresh token rotation enabled)
- `refresh_token_reuse_interval: 10s` — prevents replay attacks on refresh tokens
- On app start, the Supabase client restores the persisted session automatically; no explicit "restore session" call is needed

**Local dev vs production**:
- Local dev (`supabase start`): email confirmation is **disabled** (`enable_confirmations = false` in `supabase/config.toml`) — sign up succeeds without verifying email, enabling fast local iteration
- Production: set `enable_confirmations = true` in the production Supabase project dashboard before launching; this is intentionally not set via `config.toml` to avoid accidental commits that weaken production security

**Password policy**: minimum 8 characters (`minimum_password_length = 8` in `config.toml`).

**Auth providers enabled**: email + password only. SMS and MFA are disabled for v1.

### Environment Separation

| Concern | Local dev | Production |
|---------|-----------|------------|
| Start Supabase | `supabase start` (Docker-based local stack) | Supabase cloud project |
| Apply migrations | `supabase db reset` (re-runs all migrations) or `supabase migration up` | `supabase db push` |
| Edge functions | `supabase functions serve` (local) | `supabase functions deploy <name>` |
| Secrets | `.env.local` for edge function dev; `supabase secrets set` for local Docker stack | `supabase secrets set` against production project |
| Config file | `supabase/config.toml` controls all local services | Cloud project settings managed via Supabase dashboard |
| CI deploy | — | [`.github/workflows/deploy-supabase.yml`](../../.github/workflows/deploy-supabase.yml): on `push` to `main` when `supabase/**` changes — `supabase link`, `db push`, `functions deploy`. Repository secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD` (see README). |

**Required environment variables** (see `.env.example`):
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL (client-side, safe to expose)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client-side, safe to expose; RLS enforces access control)

The app resolves these from `expo-constants` `extra` (`supabaseUrl`, `supabaseAnonKey`), which `app.config.js` fills by reading `.env` first and otherwise falling back to `process.env`. That matches local expectations when a stale `EXPO_PUBLIC_*` value is already set in the shell, because Expo’s default dotenv loader does not override existing environment variables.
- `OPENROUTER_API_KEY` — OpenRouter API key (server-side only; stored as a Supabase project secret, never in the app bundle)

### Observability and AI I/O logging

> **ADR**: ADR-003. **Implementation**: task #019 (@backend-developer) — this section is the contract only.

AI-related edge work (`transcribe`, `assign-topics`, reminder detection in `_shared/detect-reminders.ts`, shared OpenRouter modules) is observable via **Supabase Edge Function logs** (Deno `console` output surfaced in the Supabase project dashboard). There is **no** v1 Postgres table for AI audit trails; durable user content lives in the database as today.

**PRD alignment (Security NFR):** PRD requires *no user data in **device** logs or **analytics** payloads*. That constraint does **not** forbid **server-side** Edge logs used to operate and debug the AI pipeline, as long as redaction rules below are respected. The mobile app must continue to avoid logging thought bodies, transcripts, or tokens in client-side logs or analytics.

**Retention:** Log retention, search, and export are **Supabase platform–managed** and may change; do not treat Edge logs as an indefinite or compliance-grade archive. Operational forensics should assume a bounded window unless the platform or a future ADR adds explicit export.

**Structured logging contract**

- Emit **JSON-serializable** objects; prefer **one log line per event** as **single-line JSON** via **`console.debug`** (DEBUG level) with `"log_level":"debug"` in the payload so operators can filter AI/OpenRouter noise separately from `console.error` infrastructure failures.
- Recommended fields (use when applicable; omit nullable fields rather than sending `null` noise):
  - `event` — stable event name (e.g. `ai.request.start`, `ai.response.complete`, `ai.error`)
  - `function` — edge function name (`transcribe`, `assign-topics`, `detect-reminders`, …)
  - `thought_id` — UUID string when a thought row is known
  - `user_id` — UUID string (`auth` subject) for correlation; still subject to redaction policy if product stance tightens
  - `model` — OpenRouter/model id used for the call
  - `phase` — `"transcribe"` | `"topics"` | `"reminders"` (and future phases if the pipeline splits further)
  - `request_summary` / `response_summary` — non-secret metadata and **short previews** (e.g. byte length, topic count, latency, truncated text for quick scanning)
  - `log_summary` / `log_level` — human skimming line and always `"debug"` for these events (transport is **`console.debug`**).
  - `openrouter_request` / `openrouter_response` — **nested objects** for the OpenRouter `chat/completions` request (sanitized: no API key in body; voice `input_audio.data` → **base64 length placeholder**) and response JSON. **Hosted Supabase allows ≤10,000 characters per log line**; the logger **re-trims** oversized nested blobs (`_truncated` preview). Optional env **`OPENROUTER_LOG_JSON_MAX_CHARS`** lowers the per-field budget (capped ~9k).

**Prohibited in logs**

- `OPENROUTER_API_KEY` or any Supabase **service_role** / signing secrets
- **Raw audio**: no audio buffers, base64 audio, or binary dumps
- **Full multipart bodies** or complete file payloads
- For voice **input**, log **metadata only** when needed: e.g. MIME type, size in bytes, duration in ms **if available** from client metadata or headers — never content of the recording

**Implementation (#019+):** Logging lives in `supabase/functions/transcribe`, `supabase/functions/assign-topics`, `supabase/functions/detect-reminders`, and shared helpers under `supabase/functions/_shared/` per this contract; the device and any analytics SDK payloads remain free of user content (unchanged PRD rule).

---

## Reminders Subsystem

> **ADR**: ADR-004. **Tasks**: #022–#028 (shipped 2026-03-30).
> Added: 2026-03-30

### Overview

Sanctuary detects future time references in captured thoughts ("call mum next Monday", "dentist Wednesday at 3 pm") using AI and surfaces them as user-approvable reminders. No notification fires without explicit user approval. Scheduling uses client-side local notifications via `expo-notifications` — there is no server-side scheduler in v1. The `reminders` table in PostgreSQL is the source of truth for reminder state; the local notification is a delivery mechanism only. Optionally, the user can add the same reminder as a **native calendar event** via `expo-calendar` (`src/lib/deviceCalendar.ts`): permission is requested when they choose **Add to calendar**, then the OS calendar **editor** opens prefilled; the user confirms with Save. The draft uses the reminder’s `scheduled_at` as the start time (not notification lead-time). Calendar events are not stored in Postgres in v1.

### Components

| Component | Location | Owner | Description |
|-----------|----------|-------|-------------|
| `detect-reminders` (shared module) | `supabase/functions/_shared/detect-reminders.ts` | @backend-developer | AI extraction: OpenRouter returns `{ "reminders": [ { "extracted_text" (short title), "scheduled_at" } ] }`. Inserts one or more rows with `status: 'inactive'`. |
| `detect-reminders` (edge function) | `supabase/functions/detect-reminders/index.ts` | @backend-developer | Standalone `POST` for on-demand detection (optional `current_iso_timestamp` for relative phrases). Same shared module as the pipeline. |
| `reminders` table | `supabase/migrations/004_reminders.sql` | @database-expert | `extracted_text`, `scheduled_at`, optional `lead_time` (integer minutes — reserved), `status`, `notification_id`. RLS: `user_id = auth.uid()`. |
| `user_preferences` table | `supabase/migrations/004_reminders.sql` | @database-expert | Key-value (`key` + JSONB `value`). v1 keys: `notification_lead_time` (string: `at_time` \| `15min` \| `30min` \| `1hour` \| `morning`) and `morning_notification_time` (`"HH:MM"`, default `07:30`). |
| Reminder UI | `ReminderApprovalSheet.tsx`, `inbox/index.tsx`, `ThoughtListCard.tsx`, `inbox/[thoughtId].tsx` | @react-native-developer | Pending pill + sheet; bell on inbox cards; reminder card on thought detail. Approve schedules notification; dismiss updates row. After approve, optional prompt to add a device calendar event; **Scheduled reminder** sheet includes **Add to calendar** for active reminders. |
| `expo-notifications` client | `src/lib/notifications.ts` | @react-native-developer | Permission, `scheduleReminder` / `cancelReminder`, `computeFireDate` from lead-time prefs. |
| Device calendar | `src/lib/deviceCalendar.ts`, `expo-calendar` + config plugin in `app.json` | @react-native-developer | `addReminderToDeviceCalendar`: requests calendar access, then opens the **system new-event UI** (`createEventInCalendarAsync`) prefilled with title/time so the user taps Save — avoids silent insert failures and iOS permission edge cases. Web: no-op. Native rebuild required when adding the plugin. |

### AI Detection Pipeline Placement

Reminder detection runs **after** topic assignment in both capture paths. It is **fire-and-forget** -- the capture response is never delayed or failed by reminder detection.

```
[Voice path]
  transcribe (OpenRouter) -> thoughts.body written
    -> assignTopicsToThought(...) [awaited]
    -> detectReminders(...).catch(() => {}) [fire-and-forget]
    -> HTTP response returned to client (transcript + topics)

[Text path]
  assign-topics edge function
    -> assignTopicsToThought(...) [awaited]
    -> detectReminders(...).catch(() => {}) [fire-and-forget]
    -> HTTP response returned to client (topics)
```

**Non-blocking contract**: `detectRemindersForThought` is invoked without `await` on the hot path where applicable. If detection fails, `thoughts.reminder_detection_status` is set to `'failed'` and the failure is logged via ADR-003. The capture response is unaffected.

**`reminder_detection_status`** on `thoughts` (CHECK-constrained): `'none'` (default) | `'pending'` | `'complete'` | `'failed'`. Tracks the detection pipeline only, not each reminder row’s lifecycle.

### Detection Model Contract

The shared module prompts OpenRouter for **only** valid JSON of this shape (code fences stripped if present):

```json
{
  "reminders": [
    {
      "extracted_text": "Call mum",
      "scheduled_at": "2026-04-06T14:00:00+01:00"
    }
  ]
}
```

- `reminders`: array; empty when no future time references.
- Each item must have non-empty `extracted_text` (concise reminder title) and a parseable ISO 8601 `scheduled_at`; invalid items are skipped.
- The prompt includes the caller-supplied **local “now”** (ISO with offset) and optional **IANA timezone** (`Europe/Zagreb`, etc.) from the mobile app so phrases like “next Tuesday” resolve in the user’s zone; voice and typed capture send `iana_timezone` + `current_local_iso` via `/transcribe` and `/assign-topics`. Standalone `POST /detect-reminders` accepts `iana_timezone` and `current_iso_timestamp`. Server UTC is only a fallback when the client omits local fields.
- Model resolution: `OPENROUTER_REMINDER_MODEL` → `OPENROUTER_TOPIC_MODEL` → `google/gemini-2.0-flash-001`.

### Reminder Lifecycle

```
              AI extracts ≥1 time reference
                            |
                            v
                   +------------------+
                   |     inactive      |  (row(s) inserted by edge code)
                   +--------+---------+
                            |
              +-------------+-------------+
              |                           |
         user approves              user dismisses
              |                           |
              v                           v
     +--------+---------+       +---------+--------+
     |      active       |       |    dismissed      |
     +--------+---------+       +------------------+
              |
   client schedules local notification;
   stores notification_id on row
              |
              v
     +--------+---------+
     |       sent        |  (client may set after notification fires / handling)
     +------------------+
```

**`reminders.status` values** (CHECK): `inactive` | `active` | `dismissed` | `sent`.

### Notification Scheduling (Client-Side)

When the user approves a reminder:

1. Client loads `notification_lead_time` and `morning_notification_time` from `user_preferences` (defaults: `15min`, `07:30`).
2. Computes fire time with `computeFireDate({ scheduledAt, leadTime, morningTime })` in `src/lib/notifications.ts` (`at_time`, offsets, or morning window).
3. Calls `scheduleReminder({ title, body, fireDate })` (wraps `scheduleNotificationAsync`).
4. Persists `notification_id` and sets `status` to `'active'` (and may adjust `scheduled_at` if the user edited the datetime).

On dismiss: cancel any scheduled notification by `notification_id`, then set `status` to `'dismissed'`. Reschedule flows cancel the old id before scheduling a new one.

**Device calendar (optional):** After approve (inbox sheet or thought-detail sheet), the app may offer to open the OS calendar **create-event** flow prefilled with the same title and `scheduled_at`. Active reminders can also use **Add to calendar** from the scheduled-reminder sheet. The user must confirm in the system UI (Save). Duplicates are possible if the user completes that flow multiple times; no `calendar_event_id` column in v1.

When the notification fires, the app may update the row to `sent` (see `docs/technical/API.md` direct-table patterns).

### Notification Permission

`expo-notifications` requires the user to grant notification permission. The permission request should be triggered at a contextually appropriate moment -- not on first launch. Recommended: prompt when the first reminder is detected and shown to the user for approval. Flag for @ui-ux-designer to design the permission flow UX.

### Schema summary

Canonical columns and constraints: **`docs/technical/DATABASE.md`** (`004_reminders.sql`).

**Highlights**:

- **`reminders`**: `extracted_text`, `scheduled_at`, `lead_time` (optional integer, reserved), `status` default `'inactive'`, `notification_id` nullable.
- **`user_preferences`**: one row per `(user_id, key)`; v1 keys `notification_lead_time`, `morning_notification_time`.
- **`thoughts.reminder_detection_status`**: `'none'` | `'pending'` | `'complete'` | `'failed'`.

### Observability

Reminder detection follows the ADR-003 structured logging contract. Events use `phase: "reminders"` and the same `event` vocabulary (`ai.request.start`, `ai.response.complete`, `ai.error`). Logged via `console.debug` at DEBUG level. No thought body content in logs beyond truncated previews per the existing redaction rules.

### Upgrade Path (v2: Server-Side Scheduling)

If multi-device sync or higher delivery reliability is needed, a future ADR can introduce server-side scheduling:

1. Add an `expo_push_tokens` table (user_id, token, platform, updated_at).
2. Add a `pg_cron` job (requires Supabase Pro) or external cron that queries **`reminders`** where `status = 'active'` and the computed notify time (from `scheduled_at` and user lead-time prefs) is due.
3. The job calls an edge function that sends push via the [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/).
4. The client stops calling `scheduleNotificationAsync` for approved reminders and instead registers its push token on login.
5. `status` and `scheduled_at` on `reminders` remain the primary scheduler-facing fields; lead-time rules may move server-side in that ADR.

### Cross-agent handoffs (v1 — complete)

Shipped work: migration `004_reminders`, `_shared/detect-reminders.ts`, `transcribe` / `assign-topics` fire-and-forget hooks, `detect-reminders` edge function, mobile UI and `src/lib/notifications.ts`, tests (#027), USER_GUIDE (#028). Future changes should update **DATABASE.md**, **API.md**, and this section together.

---

## OCEAN Onboarding & Morning Messages Subsystem

> **ADR**: ADR-005. **Tasks**: #037 (architecture), #038–#042 (implementation — planned).
> Added: 2026-04-11

### Overview

After a new user signs up, Sanctuary presents a 5–7 question reflective onboarding flow. The user's answers are scored by AI against the OCEAN (Big Five) model (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism). The resulting profile is stored in `ocean_profiles` and drives a personalised daily morning message. Each morning, a local notification nudges the user; opening the app shows an AI-generated card on the Quick Capture screen. This is a simplified pre-v2 variant using static onboarding data rather than the longitudinal memory layer (FR-060–063) deferred to the paid v2 tier.

### Components

| Component | Location | Owner | Description |
|-----------|----------|-------|-------------|
| `(onboarding)` route group | `src/app/(onboarding)/` | @react-native-developer | Stack of 4 screens: intro (`index.tsx`), questions (`questions.tsx`), scoring loading state (`scoring.tsx`), completion (`complete.tsx`). No tab bar. |
| Root route guard | `src/app/_layout.tsx` | @react-native-developer | Extends existing splash-screen hold to also resolve onboarding status (AsyncStorage first, then `ocean_profiles` query). Redirects to `(onboarding)` if profile absent; to `(auth)` if unauthenticated. Uses `<Redirect>` (no back-stack entry). |
| `score-ocean-profile` (edge function) | `supabase/functions/score-ocean-profile/index.ts` | @backend-developer | `POST` — accepts `{ answers: [{ question: string, answer: string }] }` + user JWT. Calls OpenRouter with a structured-output prompt; stores `{ openness, conscientiousness, extraversion, agreeableness, neuroticism }` (floats 0–1) plus raw `answers` JSONB and `question_set_version` in `ocean_profiles`. |
| `generate-morning-message` (edge function) | `supabase/functions/generate-morning-message/index.ts` | @backend-developer | `POST` — no request body; reads caller's `ocean_profiles` row; calls OpenRouter; inserts/upserts row in `morning_messages` keyed by `(user_id, generated_for_date)`; returns `{ message_text }`. |
| `ocean_profiles` table | `supabase/migrations/005_ocean_profiles.sql` | @database-expert | One row per user (UNIQUE `user_id`). Columns: `openness`, `conscientiousness`, `extraversion`, `agreeableness`, `neuroticism` (float, 0–1), `answers` (jsonb), `question_set_version` (text, default `'v1'`), `scored_at`. RLS: `user_id = auth.uid()`. |
| `morning_messages` table | `supabase/migrations/005_ocean_profiles.sql` | @database-expert | One row per user per day (UNIQUE `user_id, generated_for_date`). Columns: `message_text`, `generated_for_date` (date), `shown_at` (timestamptz, nullable). RLS: `user_id = auth.uid()`. |
| Morning message card | `src/app/(app)/index.tsx` | @react-native-developer | On Quick Capture screen: if current local time is within the morning window (`morning_notification_time` ≤ now < 12:00), query `morning_messages` for today. If absent, call `generate-morning-message`. Display as an elevated `Card` above the capture controls. Dismiss hides for the session; `shown_at` is set on first render. |
| Daily morning notification | `src/lib/notifications.ts` | @react-native-developer | On onboarding completion, schedule a repeating `DailyTriggerInput` local notification at `morning_notification_time` via `expo-notifications`. Store the returned identifier in `user_preferences` key `morning_notification_id`. Reschedule when preference changes. |
| `user_preferences` additions | Existing `user_preferences` table | — | New key: `morning_notification_id` (text) — the `expo-notifications` identifier for the daily notification, enabling cancellation and rescheduling. Existing `morning_notification_time` key (already present from ADR-004) is the source of truth for scheduling. |

### Onboarding Flow

```
New user signs up
  -> Auth session established
  -> Root _layout.tsx checks AsyncStorage for 'sanctuary:onboarding_complete:<userId>'
       |--- key absent / false ---> <Redirect href="/(onboarding)" />
       |--- key present (true) --> render (app) normally
  -> (onboarding)/index.tsx — welcome screen, brand intro
  -> (onboarding)/questions.tsx — 5 reflective questions (one per OCEAN dimension)
       Optional: questions 6-7 shown after Q5 with skip affordance
  -> (onboarding)/scoring.tsx — "Getting to know you…" loading state
       -> POST /score-ocean-profile (user JWT + answers array)
       -> OpenRouter scores answers -> OCEAN floats stored in ocean_profiles
  -> (onboarding)/complete.tsx — "Your sanctuary is ready" + first capture CTA
       -> AsyncStorage.setItem('sanctuary:onboarding_complete:<userId>', 'true')
       -> Schedule daily morning notification (DailyTriggerInput)
       -> router.replace('/(app)')
```

### Morning Message Generation Flow

```
App opens during morning window (morning_notification_time ≤ local time < 12:00)
  -> Client checks morning_messages WHERE user_id = me AND generated_for_date = today
       |--- row exists (cached) ---> render card with cached message_text
       |--- row absent -----------> POST /generate-morning-message (user JWT, no body)
                                         -> edge function reads ocean_profiles for user
                                         -> OpenRouter generates personalised message
                                         -> INSERT into morning_messages (upsert by date)
                                         -> returns { message_text }
                                    -> render card; set shown_at on morning_messages row
Daily notification:
  -> repeating DailyTriggerInput at morning_notification_time fires on device
  -> generic notification: "Your morning reflection is ready — open Sanctuary"
  -> tap opens app -> morning window check above runs -> message card shown
```

### Schema Summary

Canonical DDL: `supabase/migrations/005_ocean_profiles.sql` (planned).

**`ocean_profiles`**:
- `id` uuid PK, `user_id` uuid UNIQUE FK → `auth.users` (ON DELETE CASCADE)
- `openness`, `conscientiousness`, `extraversion`, `agreeableness`, `neuroticism` — float, NOT NULL, CHECK (0 ≤ value ≤ 1)
- `answers` jsonb (array of `{ question, answer }` — retained for re-scoring on prompt updates)
- `question_set_version` text NOT NULL DEFAULT `'v1'`
- `scored_at`, `created_at`, `updated_at` timestamptz

**`morning_messages`**:
- `id` uuid PK, `user_id` uuid FK → `auth.users` (ON DELETE CASCADE)
- `message_text` text NOT NULL
- `generated_for_date` date NOT NULL
- `shown_at` timestamptz NULL
- `created_at` timestamptz
- UNIQUE `(user_id, generated_for_date)`

Both tables: RLS CRUD where `user_id = auth.uid()`.

### Edge Function Contracts

**`score-ocean-profile`**:
- Input: `POST` with user JWT + `{ answers: [{ question: string; answer: string }], question_set_version?: string }`
- OpenRouter prompt: structured output requesting `{ openness, conscientiousness, extraversion, agreeableness, neuroticism }` as floats 0–1; system prompt instructs independent per-dimension reasoning
- Output: upserts `ocean_profiles` row; returns `{ openness, conscientiousness, extraversion, agreeableness, neuroticism, scored_at }`
- Model resolution: `OPENROUTER_OCEAN_MODEL` → `OPENROUTER_TOPIC_MODEL` → `google/gemini-2.0-flash-001`
- Logging: follows ADR-003 structured logging; `phase: "ocean_scoring"`; raw answers not logged (only `answer_count` and `question_set_version`)

**`generate-morning-message`**:
- Input: `POST` with user JWT (no body — user identity from JWT)
- Reads `ocean_profiles` for the authenticated user; returns 404 if profile not found
- OpenRouter prompt: given OCEAN scores, generate a single short morning message (≤ 3 sentences) that reflects the user's known tendencies back at them in a warm, non-prescriptive tone
- Output: upserts `morning_messages` for today's date; returns `{ message_text, generated_for_date }`
- Model resolution: `OPENROUTER_MORNING_MESSAGE_MODEL` → `OPENROUTER_TOPIC_MODEL` → `google/gemini-2.0-flash-001`
- Idempotent within a day: if a row for today already exists (possible if client retries), return existing message without calling OpenRouter
- Logging: follows ADR-003; `phase: "morning_message"`; message text logged only as a character-count preview

### Question Set (v1)

Stored as `OCEAN_QUESTIONS_V1` constant in both the mobile client and edge function shared module.

| # | Dimension | Question |
|---|-----------|---------|
| 1 | Openness | "What's something you've been curious about recently — an idea, a place, or a way of doing things that caught your attention?" |
| 2 | Conscientiousness | "When you think about the things you want to get done, what tends to help you follow through — and what tends to get in the way?" |
| 3 | Extraversion | "How do you tend to recharge after a busy or draining day? Describe what that usually looks like for you." |
| 4 | Agreeableness | "Tell me about someone in your life you feel close to. What do you value most in that relationship?" |
| 5 | Neuroticism | "What's been weighing on your mind lately? When that kind of feeling shows up, how do you usually sit with it?" |
| 6 *(optional)* | Openness (depth) | "Is there a creative pursuit, habit, or new way of thinking you've been wanting to explore but haven't made space for yet?" |
| 7 *(optional)* | Conscientiousness (depth) | "Describe a time when you felt really on top of things — organised, clear, in flow. What made that possible?" |

Questions 1–5 are always shown. Questions 6–7 are optional extensions with a skip affordance. The `question_set_version` column enables future question revisions without invalidating existing profiles.

### Observability

Both edge functions follow the ADR-003 structured logging contract. Events use `phase: "ocean_scoring"` and `phase: "morning_message"` respectively. No raw answer content or message text in logs beyond truncated previews. Model, latency, and outcome (success / error) are logged per call.

### Cross-Agent Handoffs (planned)

| Agent | Tasks |
|-------|-------|
| @database-expert | Migration `005_ocean_profiles.sql`: `ocean_profiles`, `morning_messages` tables, RLS policies, indexes |
| @backend-developer | `score-ocean-profile` and `generate-morning-message` edge functions; ADR-003 logging; OpenRouter prompt design |
| @react-native-developer | `(onboarding)` route group screens; root layout route guard; morning message card on Quick Capture; daily notification scheduling in `src/lib/notifications.ts` |
| @ui-ux-designer | Onboarding UX spec: question flow, scoring loading state, completion screen, morning message card design |

---

## Journal Subsystem

> **ADR**: ADR-006. **Tasks**: #043 (architecture), #044–#049 (implementation — planned).
> Added: 2026-04-11

### Overview

The Journal is a daily AI-guided reflection session accessible via a dedicated fourth tab in the bottom nav. Each session presents a fixed opening question (`JOURNAL_OPENING_QUESTION_V1`) followed by up to two AI-generated follow-up questions — three turns total. The AI contextualises each follow-up using the user's answers in the current session and their living `user_state`: a ~200-word third-person analysis that accumulates patterns, recurring themes, and things the user has mentioned across all sessions, without assumptions about anything they have not explicitly shared. After each completed session, the analysis is incrementally merged with the new session content via a fire-and-forget edge function call.

An evening reminder — a configurable daily local notification, default 21:00 — nudges the user to reflect each day. Like the ADR-005 morning notification, it is a client-scheduled recurring local notification via `expo-notifications` using `DailyTriggerInput`; no server-side scheduler is required.

If the user leaves mid-session (app backgrounded, killed), the next Journal tab open detects the incomplete session and offers: "Continue your earlier session or start fresh?" This is enabled by incremental persistence: every Q&A pair is written to the DB as it is answered, not only on final save.

### Components

| Component | Location | Owner | Description |
|-----------|----------|-------|-------------|
| `journal-next-question` (edge function) | `supabase/functions/journal-next-question/index.ts` | @backend-developer | `POST` — accepts session ID, completed turn history, and optional `user_state` snapshot; returns `{ "question": "...", "turn_index": N }` or `{ "done": true }`. Enforces 3-turn max server-side (returns `done` unconditionally if `turns.length >= 3`). Model: `OPENROUTER_JOURNAL_MODEL` → `OPENROUTER_TOPIC_MODEL` → `google/gemini-2.0-flash-001`. |
| `journal-save-session` (edge function) | `supabase/functions/journal-save-session/index.ts` | @backend-developer | `POST` — accepts session ID; validates ownership and at least one answered entry; marks session `completed`; returns save confirmation. Fires-and-forgets `updateUserState()`: reads current `user_state.content` + new session Q&A pairs → OpenRouter incremental merge → upserts `user_state`. |
| `journal_sessions` table | `supabase/migrations/006_journal.sql` | @database-expert | One row per session. `status`: `'pending'` (in-progress) \| `'completed'` \| `'abandoned'`. `opening_question_version` tracks which `JOURNAL_OPENING_QUESTION_V*` constant was used. RLS: `user_id = auth.uid()`. |
| `journal_entries` table | `supabase/migrations/006_journal.sql` | @database-expert | One row per turn within a session. Columns: `turn_index` (0–2), `question` text (set when displayed), `answer` (NULL until submitted), `answered_at`. UNIQUE `(session_id, turn_index)`. RLS via `user_id` column. |
| `user_state` table | `supabase/migrations/006_journal.sql` | @database-expert | One row per user (UNIQUE `user_id`). `content` text (~200-word analysis), `contributing_session_count`, `last_session_id` FK. Updated fire-and-forget by `journal-save-session` after every completed session. RLS: `user_id = auth.uid()`. |
| Journal tab screens | `src/app/(app)/journal/` | @react-native-developer | New `(app)` tab group: `journal/index.tsx` (session home — resume prompt or active session flow), `journal/history.tsx` (past sessions list), `journal/[sessionId].tsx` (session detail, read-only). History accessible via header button on the journal home. |
| Evening reminder | `src/lib/notifications.ts` | @react-native-developer | `scheduleEveningReminder(hour, minute)`: schedules a repeating `DailyTriggerInput` local notification. Toggle (on/off) and time picker in Settings. Cancels and reschedules when preference changes. |
| `user_preferences` new keys | Existing `user_preferences` table | — | `evening_notification_id` (text) — the `expo-notifications` identifier for the daily evening notification, enabling cancellation and rescheduling. `evening_notification_time` (string `"HH:MM"`, default `"21:00"`) — user-configured evening reminder time. |

### Session State Machine

```
[pending]  — session created; opening question shown; answering in progress
    |
    +--- user taps "Save Journal"  -----------> [completed]
    |                                           (completed_at set; user_state update queued)
    +--- user taps "Start fresh"   -----------> [abandoned]
         (new pending session created; old session marked abandoned)
```

**Resume detection**: on Journal tab open, query `journal_sessions WHERE user_id = auth.uid() AND status = 'pending' AND created_at > now() - interval '24 hours'`. If found: show the "Continue or start fresh?" prompt. Sessions outside the 24-hour window are not offered for resume (no automatic state transition — a future cleanup job could mark them abandoned).

**`journal_sessions.completed_at`** is NULL for `pending` and `abandoned` rows; it is set by `journal-save-session` when a session transitions to `completed`.

### Session Flow Diagram

```
[Journal tab opens]
  -> Query pending sessions (created_at > now() - 24h AND status = 'pending')
       |--- pending session found ---> Prompt: "Continue or start fresh?"
       |      |--- Continue ----> Load entries; resume from first unanswered turn
       |      |--- Start fresh -> Mark old session 'abandoned'; create new session row
       |--- no pending session ---> Insert journal_sessions row (status: 'pending')
  -> Display JOURNAL_OPENING_QUESTION_V1 (client constant — not AI-generated)
       -> Insert journal_entries row (turn_index: 0, question: <constant>, answer: NULL)
  -> User types answer -> Update journal_entries[turn_index=0].answer + answered_at

  -> POST /journal-next-question
     { session_id, turns: [{turn_index:0, q, a}], user_state_snapshot? }
       |--- { question: "...", turn_index: 1 } --->
       |      Insert journal_entries[turn_index=1]; user answers; update entry row
       |      -> POST /journal-next-question
       |         { session_id, turns: [turn0, turn1], user_state_snapshot? }
       |               |--- { question: "...", turn_index: 2 } --->
       |               |      Insert journal_entries[turn_index=2]; user answers; update entry row
       |               |      -> Show "Save Journal" button (max turns reached)
       |               |--- { done: true } -> Show "Save Journal" button (AI judged complete)
       |--- { done: true } -> Show "Save Journal" button (AI judged complete after turn 0)

  -> User taps "Save Journal"
       -> POST /journal-save-session { session_id }
            -> Validate: session belongs to caller; status = 'pending'; ≥1 answered entry
            -> journal_sessions.status = 'completed'; completed_at = now()
            -> updateUserState(userId, sessionId).catch(() => {}) [fire-and-forget]
                 -> Read user_state.content (or NULL if first session)
                 -> Read new session's journal_entries (q+a pairs)
                 -> OpenRouter: incremental merge -> updated ~200-word analysis
                 -> Upsert user_state row
            -> Return { session_id, saved_at }
       -> Navigate to Journal tab home (or history screen)
```

### Schema Summary

Canonical DDL: `supabase/migrations/006_journal.sql` (planned — see @database-expert task #045).

**`journal_sessions`**:
- `id` uuid PK, `user_id` uuid FK → `auth.users` (ON DELETE CASCADE)
- `status` text NOT NULL DEFAULT `'pending'`, CHECK (`status IN ('pending', 'completed', 'abandoned')`)
- `opening_question_version` text NOT NULL DEFAULT `'v1'`
- `completed_at` timestamptz NULL (set when status → `'completed'`)
- `created_at`, `updated_at` timestamptz
- Index: `(user_id, created_at DESC)` — primary query pattern (resume detection, history)

**`journal_entries`**:
- `id` uuid PK, `user_id` uuid FK → `auth.users` (ON DELETE CASCADE) — denormalized for RLS
- `session_id` uuid FK → `journal_sessions.id` (ON DELETE CASCADE)
- `turn_index` integer NOT NULL, CHECK (0 ≤ `turn_index` ≤ 2)
- `question` text NOT NULL (set when question is displayed)
- `answer` text NULL (populated when user submits their answer)
- `answered_at` timestamptz NULL
- `created_at` timestamptz
- UNIQUE `(session_id, turn_index)` — prevents duplicate turns within a session
- Index: `(session_id)` — load all entries for a session

**`user_state`**:
- `id` uuid PK, `user_id` uuid UNIQUE FK → `auth.users` (ON DELETE CASCADE)
- `content` text NOT NULL — the ~200-word third-person analysis
- `contributing_session_count` integer NOT NULL DEFAULT 0 — incremented on every successful update
- `last_session_id` uuid NULL FK → `journal_sessions.id` — correlation for debugging
- `updated_at` timestamptz NOT NULL, `created_at` timestamptz NOT NULL
- The UNIQUE constraint on `user_id` enables efficient upsert: `ON CONFLICT (user_id) DO UPDATE`

All three tables: RLS CRUD policies where `user_id = auth.uid()`.

### Edge Function Contracts

**`journal-next-question`**:
- Input: `POST` with user JWT + `{ "session_id": "uuid", "turns": [{ "turn_index": 0, "question": "string", "answer": "string" }], "user_state_snapshot": "optional string — the ~200-word user_state.content" }`
- `turns` contains only fully answered turns (non-NULL answer). The function returns `{ "done": true }` unconditionally if `turns.length >= 3` (server cap), regardless of the AI response.
- Output — next question: `{ "question": "string", "turn_index": 1 }` where `turn_index` is 0-based index of the question about to be asked (1 or 2)
- Output — session complete: `{ "done": true }`
- Error codes: `400` (invalid payload), `401` (unauthenticated), `404` (session not found or not owned), `500` (config/DB error), `502` (OpenRouter error)
- Logging: ADR-003, `phase: "journal_question"`; logs model, session ID, turn count, response shape. Raw answer text is **never** logged — only `answer_char_count` per turn.

**`journal-save-session`**:
- Input: `POST` with user JWT + `{ "session_id": "uuid" }`
- Validates: session exists, `user_id` matches JWT, `status = 'pending'`, at least one answered entry exists
- Sets `journal_sessions.status = 'completed'`, `completed_at = now()`
- Fire-and-forget: reads `user_state.content` (may be NULL for first session) + new session entries → OpenRouter incremental merge → upserts `user_state`; failure is logged (ADR-003) but does not affect the response
- Output: `{ "session_id": "uuid", "saved_at": "ISO 8601" }`
- Error codes: `400` (invalid payload or no answered entries), `401` (unauthenticated), `404` (session not found or not owned), `409` (session already completed), `500` (DB error)
- Logging: ADR-003, `phase: "journal_state_update"` for the user state update step; raw answer text and state content are **never** logged — only `answer_count`, `prior_state_char_count`, `updated_state_char_count`.

### Evening Reminder

Follows the exact same pattern as the ADR-005 morning notification.

1. In Settings, the user sees a toggle (evening reminder on/off) and a time picker (default `21:00`).
2. On enable (or time change), the client calls `scheduleEveningReminder(hour, minute)` in `src/lib/notifications.ts`, which calls `scheduleNotificationAsync` with `{ type: SchedulableTriggerInputTypes.DAILY, hour, minute, repeats: true }`.
3. The returned identifier is written to `user_preferences` under key `evening_notification_id`.
4. On disable, the old identifier is cancelled via `cancelScheduledNotificationAsync(id)` and the `user_preferences` row is cleared.
5. On time change, the old notification is cancelled before scheduling the new one.
6. Notification body: `"Time to reflect — your journal is waiting."` (generic, not AI-personalised in the push body — same trade-off as ADR-005 morning notification).

### Journal History

Journal history is separate from the Thoughts inbox. The `journal/history.tsx` screen lists past `journal_sessions` in reverse chronological order. Each row shows: session date, opening answer preview (first 100 characters of `journal_entries[turn_index=0].answer`), and the number of questions answered. Tapping a row navigates to `journal/[sessionId].tsx` (read-only view of the full Q&A).

### Observability

Both edge functions follow the ADR-003 structured logging contract:
- `journal-next-question`: `phase: "journal_question"` — logs `session_id`, `turn_count`, model, response type (`question` vs `done`), latency. Raw answer text is **never** logged; only `answer_char_count` per turn.
- `journal-save-session` / user state update: `phase: "journal_state_update"` — logs `session_id`, model, `prior_state_char_count`, `new_session_turn_count`, outcome. Raw answer text and state content are **never** logged.

Emitted via `console.debug` at DEBUG level; filter by `phase` field in the Supabase dashboard. Failure of the fire-and-forget user state update is an `ai.error` event in the same phase and does not surface to the user.

### Cross-Agent Handoffs

| Agent | Tasks |
|-------|-------|
| @database-expert | Migration `006_journal.sql`: `journal_sessions`, `journal_entries`, `user_state` tables, RLS policies, indexes (task #045) |
| @backend-developer | `journal-next-question` and `journal-save-session` edge functions; prompt design (non-presumptuous questions, user_state as silent context); ADR-003 logging; user state incremental merge logic (task #046) |
| @react-native-developer | Journal tab screens (`src/app/(app)/journal/`); session state machine in client; resume/start-fresh flow; evening notification scheduling and Settings UI additions in `src/lib/notifications.ts` (task #047) |
| @ui-ux-designer | Journal tab UX spec: session screen, history screen, resume prompt, evening notification Settings additions (task #044) |
| @qa-engineer | E2E and unit test strategy for session flow, resume, and user state update (task #048) |
| @documentation-writer | USER_GUIDE update: journal feature, evening reminder, "Your profile" screen (task #049) |

### UX Spec (task #044, @ui-ux-designer)

Full spec: `.assets/journal-ux-spec.md`. Summary of new and modified surfaces:

**New screens**:

| Screen | File | Description |
|--------|------|-------------|
| Journal Home | `src/app/(app)/journal/index.tsx` | Two states: State A (no pending session) shows hero headline "Your daily reflection" + "Begin today's journal" CTA + "Past entries" row; State B (pending session within 24h) shows an elevated `Card` (radius.xl) with session date, opening-answer preview, and "Continue" / "Start fresh" button pair. `useFocusEffect` re-queries on every tab focus. |
| Journal Session | `src/app/(app)/journal/session.tsx` | Full-screen stack push (no tab bar). Header: back arrow + "Journal" title + progress indicator ("1 / 3" etc.). Scrollable question `Card` (radius.lg, elevated, padding spacing.s8) + `TextInput` answer area (multiline, minHeight 120pt, surfaceContainerLow background, radius.lg) + action area pinned to bottom above keyboard. "Next" disabled until ≥10 characters. "Skip this question" available on turns 2–3 only. "Save journal" on final turn or early `done` signal. Skeleton shimmer (surfaceContainerHigh bars, 0.4↔0.8 opacity, 1200ms) during AI fetch. Inline error + "Try again" on AI fetch failure; bottom toast on save failure. Exit confirmation bottom sheet on back-arrow tap. |
| Journal Complete | `src/app/(app)/journal/complete.tsx` | Checkmark icon (Ionicons checkmark-circle-outline, 64pt, colors.primary) + "Reflection saved." headline + "Well done for taking the time." subtitle + "Back to journal" (primary) and "View your profile" (secondary) buttons + 5-second auto-redirect countdown. |
| Journal History | `src/app/(app)/journal/history.tsx` | FlatList of completed sessions, newest first. Each flat `Card` (radius.lg, surfaceContainerLow, no elevation) shows: date (labelMd, outlineVariant), 2-line opening-answer preview (bodyLg, onSurface), "N questions answered" chip + forward arrow (detail view is v2 — arrow opacity 0.4 in v1). Empty state: book icon (48pt, outlineVariant) + "No journal entries yet." + "Begin your first journal" secondary button. |
| Journal Profile | `src/app/(app)/journal/profile.tsx` | Accessible from complete screen and Settings. Introduction text (bodyLg, secondary). Elevated `Card` (radius.xl): shows `user_state.content` (bodyLg, onSurface) or placeholder (bodyLg, secondary, italic). "Last updated {relativeTime}" row (labelMd, outlineVariant). Privacy note (labelMd, outlineVariant, italic). |

**Modified screens / files**:

| File | Change |
|------|--------|
| `src/app/(app)/_layout.tsx` | Add 4th Journal tab: `Ionicons book-outline` (idle) / `book` (active), label "Journal" |
| `src/app/(app)/index.tsx` (Settings modal) | New "Journal" section after "Reminders": section label + hairline separator; evening reminder `Switch` row (trackColor: surfaceContainerHigh/primary); conditional evening time row (LayoutAnimation 300ms show/hide; instant under prefers-reduced-motion) tapping native time picker, default 21:00; "Your journal profile" row with chevron → opens profile screen |
| `src/lib/notifications.ts` | Add `scheduleEveningReminder(hour, minute)` and `cancelEveningReminder()` following the ADR-005 morning notification pattern (`DailyTriggerInput`); persist identifier in `user_preferences.evening_notification_id` |

**No new design tokens** are introduced by this feature. All values are drawn from the existing `src/lib/theme.ts` token set.

---

## Data Flow

### Thought Capture Flow (happy path)

```
User taps "Capture" -> TextInput or VoiceRecorder
  -> [Voice path] Audio recorded locally on device
     -> Thought row inserted immediately (body: "", transcription_status: 'pending')
     -> Audio file sent directly to Edge function `transcribe` (multipart/form-data)
     -> OpenRouter transcribes audio -> returns transcript text
     -> `thoughts.body` updated, transcription_status: 'complete'
     -> Shared `assign-topics` runs: user_topics + thought_topics + thoughts.topics, tagging_status: 'complete' or 'failed'
     -> `detect-reminders` fires (non-blocking, fire-and-forget): if time ref found, reminders row created
     -> `detect-list` fires (non-blocking, fire-and-forget, planned): if list detected, user_lists + list_items rows created; if continuation, items appended to existing list
     -> Audio file discarded (never stored server-side)
  -> [Text path] Thought row inserted with body text
  -> Edge function `assign-topics` called with thought text
  -> OpenRouter returns structured topic JSON (threshold 0.2 for reuse vs new topic)
  -> `thoughts.topics` updated (one-element array), tagging_status: 'complete' or 'failed'
  -> `detect-reminders` fires (non-blocking, fire-and-forget): if time ref found, reminders row created
  -> `detect-list` fires (non-blocking, fire-and-forget, planned): if list detected, user_lists + list_items rows created; if continuation, items appended to existing list
  -> Inbox refreshes to show new thought with topic chip
  -> [If reminder detected] User sees reminder prompt on thought -> approves -> client schedules local notification
  -> [If list detected] Thought card shows as interactive list with checkboxes; tapping an item marks it done
```

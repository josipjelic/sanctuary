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

> Last updated: 2026-03-30 (Reminders subsystem: ADR-004; AI I/O observability: ADR-003)
> Version: 0.1.0

---

## Product deltas (vs PRD.md)

PRD v1.1 documents user-scoped topics and the transcribe/assign-topics pipeline. The following implementation notes remain for agents (ADR-002, `docs/technical/API.md`):

- User-facing vocabulary is **topics** (not “tags”): each user has a `user_topics` catalog; each thought has **one primary topic** assigned by AI.
- Topic assignment reuses an existing topic only when the model reports `best_match_score` **>** **0.2**; otherwise a new catalog row is created (see ADR-002).
- **Voice**: `/transcribe` writes the transcript then runs topic assignment in the same edge invocation (no separate client call).
- **Text**: `/assign-topics` runs the same shared logic after insert.
- **Reminders** (ADR-004): AI detects future time references in thought text after topic assignment (fire-and-forget, non-blocking). Detected reminders are stored as `pending_approval` rows in a `reminders` table. Users approve or dismiss in the app. Approved reminders are scheduled as **client-side local notifications** via `expo-notifications` -- no server-side scheduler in v1. PRD v1.0 section 7 listed reminders as out-of-scope; the product owner explicitly directed this addition.

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
| Voice recording | expo-audio | SDK-bundled | Quick Capture microphone recording (`expo-av` removed; SDK 54 deprecates AV) |
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
| `detect-reminders` | POST | JSON `thought_id` + `text` → AI detection of future time references → `reminders` row if found | Planned — task #024+ (shared module called fire-and-forget from `transcribe` and `assign-topics`; standalone endpoint for re-detection) |
| `reflection-prompt` | POST | Receives thought text, returns an AI-generated reflection question — does not persist to DB | Planned — task #010 |

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

**Required environment variables** (see `.env.example`):
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL (client-side, safe to expose)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client-side, safe to expose; RLS enforces access control)
- `OPENROUTER_API_KEY` — OpenRouter API key (server-side only; stored as a Supabase project secret, never in the app bundle)

### Observability and AI I/O logging

> **ADR**: ADR-003. **Implementation**: task #019 (@backend-developer) — this section is the contract only.

AI-related edge work (`transcribe`, `assign-topics`, shared OpenRouter/topic modules) is observable via **Supabase Edge Function logs** (Deno `console` output surfaced in the Supabase project dashboard). There is **no** v1 Postgres table for AI audit trails; durable user content lives in the database as today.

**PRD alignment (Security NFR):** PRD requires *no user data in **device** logs or **analytics** payloads*. That constraint does **not** forbid **server-side** Edge logs used to operate and debug the AI pipeline, as long as redaction rules below are respected. The mobile app must continue to avoid logging thought bodies, transcripts, or tokens in client-side logs or analytics.

**Retention:** Log retention, search, and export are **Supabase platform–managed** and may change; do not treat Edge logs as an indefinite or compliance-grade archive. Operational forensics should assume a bounded window unless the platform or a future ADR adds explicit export.

**Structured logging contract**

- Emit **JSON-serializable** objects; prefer **one log line per event** as **single-line JSON** via **`console.debug`** (DEBUG level) with `"log_level":"debug"` in the payload so operators can filter AI/OpenRouter noise separately from `console.error` infrastructure failures.
- Recommended fields (use when applicable; omit nullable fields rather than sending `null` noise):
  - `event` — stable event name (e.g. `ai.request.start`, `ai.response.complete`, `ai.error`)
  - `function` — edge function name (`transcribe`, `assign-topics`)
  - `thought_id` — UUID string when a thought row is known
  - `user_id` — UUID string (`auth` subject) for correlation; still subject to redaction policy if product stance tightens
  - `model` — OpenRouter/model id used for the call
  - `phase` — `"transcribe"` | `"topics"` (and future phases if the pipeline splits further)
  - `request_summary` / `response_summary` — non-secret metadata and **short previews** (e.g. byte length, topic count, latency, truncated text for quick scanning)
  - `log_summary` / `log_level` — human skimming line and always `"debug"` for these events (transport is **`console.debug`**).
  - `openrouter_request` / `openrouter_response` — **nested objects** for the OpenRouter `chat/completions` request (sanitized: no API key in body; voice `input_audio.data` → **base64 length placeholder**) and response JSON. **Hosted Supabase allows ≤10,000 characters per log line**; the logger **re-trims** oversized nested blobs (`_truncated` preview). Optional env **`OPENROUTER_LOG_JSON_MAX_CHARS`** lowers the per-field budget (capped ~9k).

**Prohibited in logs**

- `OPENROUTER_API_KEY` or any Supabase **service_role** / signing secrets
- **Raw audio**: no audio buffers, base64 audio, or binary dumps
- **Full multipart bodies** or complete file payloads
- For voice **input**, log **metadata only** when needed: e.g. MIME type, size in bytes, duration in ms **if available** from client metadata or headers — never content of the recording

**Handoff (#019):** Implement logging in `supabase/functions/transcribe`, `supabase/functions/assign-topics`, and shared helpers under `supabase/functions/_shared/` per this contract; keep the device and any analytics SDK payloads free of user content (unchanged PRD rule).

---

## Reminders Subsystem

> **ADR**: ADR-004. **Task**: #022 (architecture), #023 (schema), #024+ (implementation).
> Added: 2026-03-30

### Overview

Sanctuary detects future time references in captured thoughts ("call mum next Monday", "dentist Wednesday at 3 pm") using AI and surfaces them as user-approvable reminders. No notification fires without explicit user approval. Scheduling uses client-side local notifications via `expo-notifications` -- there is no server-side scheduler in v1. The `reminders` table in PostgreSQL is the source of truth for reminder state; the local notification is a delivery mechanism only.

### Components

| Component | Location | Owner | Description |
|-----------|----------|-------|-------------|
| `detect-reminders` (shared module) | `supabase/functions/_shared/detect-reminders.ts` | @backend-developer | AI detection: sends thought text to OpenRouter, receives structured JSON with extracted datetime and description. Writes a `reminders` row with `status: 'pending_approval'`. |
| `detect-reminders` (edge function) | `supabase/functions/detect-reminders/index.ts` | @backend-developer | Standalone endpoint for on-demand re-detection (e.g. after a thought edit). Same shared module. |
| `reminders` table | `supabase/migrations/` | @database-expert | Stores detected reminders: `thought_id`, `scheduled_at`, `description`, `status`, `notification_id`, `lead_time`. RLS: user-scoped via FK to `thoughts`. |
| `user_preferences` table | `supabase/migrations/` | @database-expert | Per-user settings including `notification_lead_time` (enum: `15min`, `30min`, `1hour`, `morning`) and `morning_time` (time, default `08:00`). RLS: `user_id = auth.uid()`. |
| Reminder approval UI | `src/` (screens + components) | @react-native-developer | Inline prompt on thought detail or inbox card: shows detected reminder, lets user approve/edit/dismiss. On approve: schedules local notification. |
| `expo-notifications` client | `src/lib/notifications.ts` | @react-native-developer | Wraps `expo-notifications`: permission request, `scheduleNotificationAsync`, cancel by `notificationId`. |

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

**Non-blocking contract**: `detectReminders` is called without `await` in the response path. The Deno isolate continues executing the background promise after the response is sent. If detection fails, `thoughts.reminder_detection_status` is set to `'failed'` and the failure is logged via the ADR-003 structured logging contract. The client never sees the failure.

**`reminder_detection_status`** on `thoughts`: `'none'` (default) | `'pending'` | `'detected'` | `'no_reminder'` | `'failed'`. This column tracks whether detection has run and what it found, independent of the reminder row's own lifecycle status.

### Detection Model Contract

The shared `detect-reminders.ts` module sends the thought text to OpenRouter and expects structured JSON:

```json
{
  "has_reminder": true,
  "description": "Call mum",
  "datetime_iso": "2026-04-06T14:00:00",
  "confidence": 0.85
}
```

- `has_reminder`: boolean -- whether the thought contains a future time reference.
- `description`: short label for the reminder (extracted from thought text).
- `datetime_iso`: ISO 8601 datetime string (without timezone -- interpreted as user-local time).
- `confidence`: 0--1 score. Below a configurable threshold (default 0.5, env `REMINDER_CONFIDENCE_THRESHOLD`), the detection is discarded and `reminder_detection_status` is set to `'no_reminder'`.

When `has_reminder` is true and confidence is above threshold, a `reminders` row is inserted with `status: 'pending_approval'`. The model used is configurable via `OPENROUTER_REMINDER_MODEL` (env), falling back to `google/gemini-2.0-flash-001`.

### Reminder Lifecycle

```
                     AI detects time ref
                            |
                            v
                   +------------------+
                   | pending_approval  |  (reminders row created by edge function)
                   +--------+---------+
                            |
              +-------------+-------------+
              |                           |
         user approves              user dismisses
              |                           |
              v                           v
     +--------+---------+       +---------+--------+
     |     approved      |       |     dismissed     |
     +--------+---------+       +------------------+
              |
   client schedules local
   notification (expo-notifications)
   stores notificationId on row
              |
              v
     +--------+---------+
     |       fired       |  (client marks after notification callback)
     +------------------+
```

**Status values**: `pending_approval` | `approved` | `dismissed` | `fired` | `expired` (set if `scheduled_at` passes without approval).

### Notification Scheduling (Client-Side)

When the user approves a reminder:

1. Client reads the user's `notification_lead_time` preference (default `15min`).
2. Computes fire time:
   - For `15min` / `30min` / `1hour`: `scheduled_at - lead_time`.
   - For `morning`: user's `morning_time` on the day of `scheduled_at` (or the day before if `scheduled_at` is before `morning_time`).
3. Calls `Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: { date: fireTime } })`.
4. Stores the returned `notificationId` on the `reminders` row (column `notification_id`).
5. Updates `reminders.status` to `'approved'`.

If the user edits the time or dismisses: cancel the existing notification via `Notifications.cancelScheduledNotificationAsync(notificationId)`, then reschedule or mark dismissed.

When the notification fires, a foreground/background listener marks `reminders.status = 'fired'`.

### Notification Permission

`expo-notifications` requires the user to grant notification permission. The permission request should be triggered at a contextually appropriate moment -- not on first launch. Recommended: prompt when the first reminder is detected and shown to the user for approval. Flag for @ui-ux-designer to design the permission flow UX.

### Schema Summary (for @database-expert, task #023)

**`reminders` table**:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `user_id` | uuid FK -> auth.users ON DELETE CASCADE | Owner |
| `thought_id` | uuid FK -> thoughts ON DELETE CASCADE | Source thought |
| `description` | text NOT NULL | Short reminder label |
| `scheduled_at` | timestamptz NOT NULL | When the reminder is for |
| `lead_time` | text NOT NULL DEFAULT '15min' | Lead time used at scheduling |
| `status` | text NOT NULL DEFAULT 'pending_approval' | Lifecycle status |
| `notification_id` | text NULL | Expo local notification identifier |
| `confidence` | real NOT NULL | AI detection confidence score |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | |

RLS: CRUD where `user_id = auth.uid()`.

**`user_preferences` table**:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `user_id` | uuid UNIQUE FK -> auth.users ON DELETE CASCADE | Owner (one row per user) |
| `notification_lead_time` | text NOT NULL DEFAULT '15min' | `15min`, `30min`, `1hour`, `morning` |
| `morning_time` | time NOT NULL DEFAULT '08:00' | For `morning` lead time preset |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | |

RLS: CRUD where `user_id = auth.uid()`.

**`thoughts` table addition**: `reminder_detection_status` column (`text NOT NULL DEFAULT 'none'`): `'none'` | `'pending'` | `'detected'` | `'no_reminder'` | `'failed'`.

### Observability

Reminder detection follows the ADR-003 structured logging contract. Events use `phase: "reminders"` and the same `event` vocabulary (`ai.request.start`, `ai.response.complete`, `ai.error`). Logged via `console.debug` at DEBUG level. No thought body content in logs beyond truncated previews per the existing redaction rules.

### Upgrade Path (v2: Server-Side Scheduling)

If multi-device sync or higher delivery reliability is needed, a future ADR can introduce server-side scheduling without schema changes:

1. Add an `expo_push_tokens` table (user_id, token, platform, updated_at).
2. Add a `pg_cron` job (requires Supabase Pro) or external cron that queries `reminders WHERE status = 'approved' AND scheduled_at - lead_time <= now()`.
3. The job calls an edge function that sends push via the [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/).
4. The client stops calling `scheduleNotificationAsync` and instead registers its push token on login.
5. No changes to the `reminders` table schema -- `status` and `scheduled_at` are already the fields a server-side scheduler would query.

### Cross-Agent Handoffs

- **@database-expert** (task #023): Create migration for `reminders` table, `user_preferences` table, and `reminder_detection_status` column on `thoughts`. RLS policies per standard pattern.
- **@backend-developer** (task #024+): Implement `_shared/detect-reminders.ts` shared module and integrate fire-and-forget calls in `transcribe/index.ts` and `assign-topics/index.ts`. Optionally create standalone `detect-reminders` edge function for re-detection on thought edit.
- **@react-native-developer** (task #024+): Implement `expo-notifications` wrapper (`src/lib/notifications.ts`), reminder approval UI, notification scheduling on approve, notification listeners to mark `fired`.
- **@ui-ux-designer**: Design the reminder approval prompt (inline on thought detail or inbox card), notification permission request flow, and user preferences UI for lead time.

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
     -> Audio file discarded (never stored server-side)
  -> [Text path] Thought row inserted with body text
  -> Edge function `assign-topics` called with thought text
  -> OpenRouter returns structured topic JSON (threshold 0.2 for reuse vs new topic)
  -> `thoughts.topics` updated (one-element array), tagging_status: 'complete' or 'failed'
  -> `detect-reminders` fires (non-blocking, fire-and-forget): if time ref found, reminders row created
  -> Inbox refreshes to show new thought with topic chip
  -> [If reminder detected] User sees reminder prompt on thought -> approves -> client schedules local notification
```

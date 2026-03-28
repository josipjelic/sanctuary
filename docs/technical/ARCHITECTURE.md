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

> Last updated: 2026-03-28 (user-scoped topics + assign-topics pipeline)
> Version: 0.1.0

---

## Product deltas (vs PRD.md)

PRD v1.1 documents user-scoped topics and the transcribe/assign-topics pipeline. The following implementation notes remain for agents (ADR-002, `docs/technical/API.md`):

- User-facing vocabulary is **topics** (not “tags”): each user has a `user_topics` catalog; each thought has **one primary topic** assigned by AI.
- Topic assignment reuses an existing topic only when the model reports `best_match_score` **>** **0.2**; otherwise a new catalog row is created (see ADR-002).
- **Voice**: `/transcribe` writes the transcript then runs topic assignment in the same edge invocation (no separate client call).
- **Text**: `/assign-topics` runs the same shared logic after insert.

---

## Overview

Sanctuary is a React Native mobile application (built with Expo) backed by Supabase as a managed backend-as-a-service. The mobile app communicates directly with Supabase for authentication, database reads/writes, and file storage. AI capabilities (voice transcription and topic assignment) are handled by Supabase Edge Functions that proxy to OpenRouter, keeping API credentials server-side.

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
|  Auth  |  PostgreSQL  |  Storage          |
|                                           |
|  Edge Functions                           |
|    +-- transcribe (voice -> text + topics)|
|    +-- assign-topics (text -> topics)     |
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
| Backend-as-a-service | Supabase | Latest | Auth, PostgreSQL, storage, edge functions — no custom server needed |
| Database | PostgreSQL | 15 (managed by Supabase) | Relational, RLS support, well-understood |
| AI proxy | OpenRouter | Latest | Model-flexible — swap transcription/tagging models without code changes |
| State management | TBD (Zustand or React Context) | TBD | Lightweight; to be decided in task #004 |
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

**Barrel export**: `src/components/index.ts` — import any component with `import { Button, Card, TextInput, Topic } from '@/components'`.

**Fonts**: Manrope (400/600/700) and Plus Jakarta Sans (400/600) loaded via `@expo-google-fonts/manrope` and `@expo-google-fonts/plus-jakarta-sans`. Font loading and splash screen management live in `src/app/_layout.tsx`.

---

## Mobile Architecture

> Last updated: 2026-03-28 by @react-native-developer (task #002)

### Folder Structure

```
src/
  app/              # Expo Router screens and layouts (file-based routing)
    _layout.tsx     # Root layout — wraps the entire navigator stack
    index.tsx       # Home screen (maps to "/" route)
  components/       # Shared UI components (empty at init; populated per task)
  lib/
    supabase.ts     # Supabase JS client singleton, initialized with AsyncStorage
  hooks/            # Custom React hooks (empty at init)
  types/            # TypeScript types and interfaces (empty at init)
assets/             # Static images, icons, fonts
tests/
  e2e/              # E2E tests (framework TBD — Detox or Maestro)
```

### Navigation

Navigation is handled by **Expo Router v6** using file-based routing. The `src/app/` directory is the route root, following the Expo Router convention for a `src/`-based layout.

- `src/app/_layout.tsx` — Root layout. Renders a `<Stack>` navigator. Also imports the URL polyfill (`react-native-url-polyfill/auto`) required by the Supabase client.
- `src/app/index.tsx` — Entry screen, maps to the `/` route. Shown immediately after the app loads.

Deep linking is configured via `app.json` (`scheme: "sanctuary"`) and the `expo-router` plugin. All navigable screens must declare a deep link route once they are implemented (task #005 and beyond).

Route params will be typed in `src/navigation/types.ts` once the full navigation hierarchy is defined (task #005).

### Supabase Client

The Supabase JS client is initialized in `src/lib/supabase.ts` as a module-level singleton. Key configuration:

- **Storage**: `AsyncStorage` from `@react-native-async-storage/async-storage` — persists the auth session across app restarts.
- **autoRefreshToken**: `true` — the client automatically refreshes expiring JWTs.
- **detectSessionInUrl**: `false` — disabled because React Native does not use URL-based OAuth callbacks the same way as web apps.
- **Environment variables**: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are read at module initialization. The client throws a descriptive error at startup if either variable is missing, preventing silent failures in misconfigured environments.

### State Management

State management strategy is **TBD** — to be decided in task #004. Candidates are Zustand (for global app state) and React Context (for simpler shared state). Server data will use React Query once task #004 is resolved.

Local UI state (form inputs, toggle open/closed) uses `useState` throughout. No global state library is introduced until task #004 is complete.

---

## Backend Architecture

> Last updated: 2026-03-28 by @backend-developer (task #003)

### Edge Function Inventory

All edge functions are deployed to Supabase and live under `supabase/functions/`. They are invoked by the mobile app via `supabase.functions.invoke()`, which automatically injects the user's session token as a Bearer header.

| Function | Method | Description | Status |
|----------|--------|-------------|--------|
| `transcribe` | POST | Multipart audio → OpenRouter transcription → `thoughts.body`, then shared topic assignment (`_shared/assign-topics.ts`) | Implemented |
| `assign-topics` | POST | JSON `thought_id` + `text` → same shared topic assignment (typed capture) | Implemented |
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
- Edge functions use the Supabase **service role key** (never the anon key) for DB writes that must bypass RLS (e.g., updating `thoughts.body` after transcription). This key is stored as a Supabase project secret and is never exposed client-side.
- The anon key used by the mobile app is safe to ship — it cannot bypass RLS.

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
     -> Audio file discarded (never stored server-side)
  -> [Text path] Thought row inserted with body text
  -> Edge function `assign-topics` called with thought text
  -> OpenRouter returns structured topic JSON (threshold 0.2 for reuse vs new topic)
  -> `thoughts.topics` updated (one-element array), tagging_status: 'complete' or 'failed'
  -> Inbox refreshes to show new thought with topic chip
```

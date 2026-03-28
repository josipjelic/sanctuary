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

> Last updated: 2026-03-28
> Version: 0.1.0

---

## Overview

Sanctuary is a React Native mobile application (built with Expo) backed by Supabase as a managed backend-as-a-service. The mobile app communicates directly with Supabase for authentication, database reads/writes, and file storage. AI capabilities (voice transcription and thought tagging) are handled by Supabase Edge Functions that proxy to OpenRouter, keeping API credentials server-side.

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
|    +-- transcribe (voice -> text)         |
|    +-- tag-thought (text -> tags)         |
+------------------+-----------------------+
                   |
                   |  OpenRouter API
                   v
+------------------------------------------+
|              OpenRouter                   |
|  (model-flexible AI proxy)                |
|  - Whisper / Groq for transcription       |
|  - Claude / GPT for tagging + prompts     |
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
| Mobile framework | Expo | SDK 52+ | Cross-platform React Native with managed workflow; fast iteration |
| Language | TypeScript | 5.x | Type safety across app and shared types |
| Navigation | Expo Router | 4.x | File-based routing, deep linking support |
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

Full token set and component specs to be implemented in task #004.

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

Navigation is handled by **Expo Router v4** using file-based routing. The `src/app/` directory is the route root, following the Expo Router convention for a `src/`-based layout.

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

> To be filled in by @backend-developer after task #003 (Supabase configuration) is complete.

[Edge function inventory, RLS policy patterns, auth configuration details]

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
     -> Audio file discarded (never stored server-side)
  -> [Text path] Thought row inserted with body text
  -> Edge function `tag-thought` called with thought text
  -> OpenRouter returns tag array
  -> `thoughts.tags` updated, tagging_status: 'complete'
  -> Inbox refreshes to show new thought with tags
```

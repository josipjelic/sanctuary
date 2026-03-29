# Sanctuary

A calm, mindful mobile app for capturing thoughts, journaling, and daily reflection — powered by AI transcription and topic assignment.

---

## Overview

Sanctuary is your personal digital sanctuary — a friction-free space to offload thoughts before they disappear, journal on the ones that matter, and check in with yourself daily.

Most productivity apps are built for "hustle culture": dense interfaces, endless notifications, gamified streaks. Sanctuary is the opposite. It's quiet, spacious, and serene — designed around the idea that your thoughts deserve a calm home.

Capture anything: an idea, a feeling, a grocery list, a voice memo. Sanctuary transcribes it, assigns a topic with AI, and files it away. Come back when you're ready to reflect.

**Who it's for:** Individuals seeking calm and clarity — people who want a mindful, low-friction place to capture what's on their mind and reflect on it.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile framework | Expo (React Native) |
| Language | TypeScript (strict mode) |
| Auth + Database | Supabase (PostgreSQL + RLS) |
| File storage | Supabase Storage |
| AI (transcription + topics) | OpenRouter (model-flexible) |
| Package manager | pnpm |
| Formatter + Linter | Biome |
| Unit tests | Jest |
| E2E tests | TBD (Detox or Maestro) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Expo Go app on your iOS or Android device, or a simulator/emulator
- A Supabase project ([supabase.com](https://supabase.com))
- An OpenRouter API key ([openrouter.ai](https://openrouter.ai))

### Install

```bash
git clone <repo-url>
cd sanctuary
pnpm install
```

### Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENROUTER_API_KEY=your-openrouter-key
```

> `OPENROUTER_API_KEY` is used only in Supabase Edge Functions — never expose it client-side.

### Supabase auth redirect URLs (email confirm & password reset)

Sign-up confirmation and password-reset emails open the app via deep links built with `expo-linking` (`Linking.createURL`). In the [Supabase Dashboard](https://supabase.com/dashboard) go to **Authentication → URL Configuration** and add:

- **Redirect URLs:** include the exact URLs your build produces for `auth/callback` and `auth/reset-password` (see `getEmailConfirmationRedirectUrl` / `getPasswordResetRedirectUrl` in [`src/lib/auth-redirect.ts`](src/lib/auth-redirect.ts)). For standalone/dev builds this is typically `sanctuary://auth/callback` and `sanctuary://auth/reset-password`. You can add `sanctuary://**` if your project allows that pattern.
- **Expo Go / dev:** if `createURL` returns an `exp://…` URL, add that literal URL while testing from Expo Go.
- Optionally set **Site URL** to a non-`localhost` value so dashboard defaults are not a web dev server you do not use.

### Run

```bash
pnpm start          # Start Expo dev server
pnpm run ios        # Open in iOS simulator
pnpm run android    # Open in Android emulator
```

Scan the QR code with Expo Go to run on your physical device.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous (public) key |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key — server-side only (edge functions) |

---

## Commands

| Command | Description |
|---------|-------------|
| `pnpm start` | Start Expo dev server |
| `pnpm run ios` | Run on iOS simulator |
| `pnpm run android` | Run on Android emulator |
| `pnpm test` | Run unit tests (Jest) |
| `pnpm run lint` | Run Biome linter |
| `pnpm run typecheck` | TypeScript type check |
| `pnpm run db:push` | Push `supabase/migrations/` to the linked remote database (requires [Supabase CLI](https://supabase.com/docs/guides/cli) `login` + `link`) |

---

## Documentation

- [`PRD.md`](PRD.md) — Product requirements (edit only with explicit human approval in-session; see `CLAUDE.md`)
- [`TODO.md`](TODO.md) — Prioritized backlog
- [`docs/technical/ARCHITECTURE.md`](docs/technical/ARCHITECTURE.md) — System design
- [`docs/technical/DECISIONS.md`](docs/technical/DECISIONS.md) — Architecture Decision Records
- [`docs/technical/DATABASE.md`](docs/technical/DATABASE.md) — Schema reference
- [`docs/user/USER_GUIDE.md`](docs/user/USER_GUIDE.md) — User guide

---

## License

MIT

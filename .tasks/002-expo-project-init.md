---
id: "002"
title: "Initialize Expo project with navigation and Supabase client"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "high"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-001", "FR-002", "FR-004", "FR-005"]
blocks: ["004", "005", "006", "015"]
blocked_by: []
---

## Description

Bootstrap the Expo React Native project with the correct folder structure, navigation setup, and Supabase client configuration. This is the foundational task that all mobile screens depend on. The project should use Expo Router for file-based navigation, TypeScript in strict mode, Biome for linting/formatting, and the Supabase JS client initialized with environment variables. The folder structure should match `CLAUDE.md` (`src/app/`, `src/components/`, `src/lib/`, `src/hooks/`, `src/types/`).

## Acceptance Criteria

- [ ] `expo init` or `create-expo-app` scaffolded with TypeScript template
- [ ] Expo Router configured for file-based navigation
- [ ] `src/lib/supabase.ts` created — Supabase client initialized with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `.env.example` file created with all required env var keys (no values)
- [ ] `biome.json` configured for TypeScript + React Native
- [ ] Jest configured for unit tests
- [ ] `pnpm start`, `pnpm run ios`, `pnpm run android`, `pnpm test`, `pnpm run lint`, `pnpm run typecheck` all work
- [ ] App runs in Expo Go on iOS simulator without errors
- [ ] `docs/technical/ARCHITECTURE.md` Mobile Architecture section updated with folder structure and navigation approach

## Technical Notes

- Use `EXPO_PUBLIC_` prefix for all Supabase client-side env vars (Expo requirement)
- Expo Router v4+ uses the `app/` directory (inside `src/`)
- Install: `@supabase/supabase-js`, `expo-router`, `@react-navigation/native`, `react-native-url-polyfill`
- Session persistence: use `AsyncStorage` adapter for Supabase auth session (`@react-native-async-storage/async-storage`)
- See ADR-001 in `docs/technical/DECISIONS.md` for stack rationale

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |

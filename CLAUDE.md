# Sanctuary — Claude Instructions

> Stack: Expo (React Native) · TypeScript · Supabase (PostgreSQL) · OpenRouter · pnpm
> Last updated: 2026-03-28

## Project Context

Sanctuary is a mobile app (React Native/Expo) that serves as a digital sanctuary for personal thought capture and reflection. Users capture thoughts as text or voice recordings; AI (via OpenRouter) transcribes and auto-tags them. The app also supports journaling, daily check-ins, and mood tracking — built for individuals seeking calm and clarity in a distraction-free, serene interface.

**Tech stack summary**: Expo (React Native) · Supabase (auth + PostgreSQL + storage) · OpenRouter (AI transcription + tagging) · pnpm

---

## Agents Available

**Mandatory delegation — this is not optional.** Every task that falls within a specialist's domain MUST be routed to that agent. Do not implement code, design schemas, write docs, or configure pipelines yourself — delegate. Only handle directly: project-level questions, routing decisions, and tasks explicitly outside all specialist domains.

| Agent | Role | Invoke when... |
|-------|------|----------------|
| `project-manager` | Backlog & coordination | "What's next?", sprint planning, breaking down features, reprioritizing |
| `systems-architect` | Architecture & ADRs | New feature design, tech decisions, system integration |
| `react-native-developer` | Mobile UI implementation | Expo screens, navigation, native modules, platform styling, mobile performance |
| `frontend-developer` | UI components | Shared component library, design system implementation |
| `backend-developer` | API & business logic | Supabase edge functions, OpenRouter integrations, auth config, background jobs |
| `ui-ux-designer` | UX & design system | User flows, wireframes, component specs, accessibility |
| `database-expert` | Schema & queries | Supabase table design, RLS policies, migrations, query optimization |
| `qa-engineer` | Testing | E2E tests, test strategy, coverage gaps |
| `documentation-writer` | Living docs | User guide updates, post-feature documentation |
| `cicd-engineer` | CI/CD & GitHub Actions | Expo build pipelines, deployments, branch protection, release automation |
| `docker-expert` | Containerization | Only if a custom backend service is added — not needed for Supabase-only setup |
| `copywriter-seo` | Copy & SEO | Landing page copy (v2+), marketing content, brand voice |

---

## Critical Rules

These apply to all agents at all times. No exceptions without explicit human instruction.

1. **PRD.md requires explicit human approval to modify.** Do not edit it unless the human has clearly instructed you to do so in the current conversation. Read it to understand requirements.
2. **TODO.md is the living backlog.** Agents may add items, mark items complete, and move items to "Completed". Preserve section order and existing item priority — do not reorder items within a section unless explicitly asked to reprioritize.
3. **All commits use Conventional Commits format** (see Git Conventions below).
4. **Update the relevant `docs/` file** after every significant change before marking a task complete.
5. **Run tests before marking any implementation task complete.**
6. **Never hardcode secrets, credentials, or environment-specific values** in source code. Use `.env` files and `EXPO_PUBLIC_` prefix for client-safe vars.
7. **Consult `docs/technical/DECISIONS.md`** before proposing changes that may conflict with prior architectural decisions.
8. **Always delegate to the right specialist.** If a task touches mobile UI, backend/integrations, database, UX/design, QA, documentation, or CI/CD — invoke the appropriate agent immediately. Do not implement it yourself. The delegation table above is binding, not advisory.
9. **Commit your own changes; never push.** After completing your work, create a local commit (Conventional Commits format). Do not `git push`. The orchestrator is responsible for pushing the branch and opening the PR.

---

## Project Structure

```
src/
  app/              # Expo Router screens and layouts
  components/       # Shared UI components
  lib/              # Supabase client, OpenRouter client, utilities
  hooks/            # Custom React hooks
  types/            # TypeScript types and interfaces
assets/             # Images, fonts, icons
tests/
  e2e/              # E2E tests (Detox or Maestro — TBD)
docs/
  user/USER_GUIDE.md
  technical/        # ARCHITECTURE.md, API.md, DATABASE.md, DECISIONS.md
  content/          # CONTENT_STRATEGY.md (N/A for v1)
.claude/agents/     # Specialist agent definitions
.claude/templates/  # Blank doc templates (synced from upstream — do not edit)
.tasks/             # Detailed task files — one per TODO item (owned by @project-manager)
```

---

## Git Conventions

### Commit Format
```
<type>(<scope>): <short description>

[optional body]
[optional footer: Closes #issue]
```

**Types**: `feat` · `fix` · `docs` · `style` · `refactor` · `test` · `chore` · `perf` · `ci`

Examples:
```
feat(capture): add voice recording to quick capture screen
fix(auth): handle expired session token gracefully
docs(database): update schema after adding daily_checkins table
```

### Branch Naming
```
feature/<ticket-id>-short-description
fix/<ticket-id>-short-description
chore/<description>
docs/<description>
refactor/<description>
```

### PR Requirements

> **Workflow note:** Specialist agents commit locally; the orchestrator pushes and opens the PR.

- PR title follows Conventional Commits format
- Fill out `.github/PULL_REQUEST_TEMPLATE.md` completely — do not delete sections
- Link to the related issue/ticket (`Closes #XXX`)
- At least one reviewer required before merge
- All CI checks must pass

---

## Code Style

- **Language**: TypeScript (strict mode)
- **Formatter + Linter**: Biome — config in `biome.json`
- **Import style**: absolute imports from `src/` (configured in `tsconfig.json`)
- **No `console.log`** in production code — use a logger utility
- **No commented-out code** committed — delete it or track it in TODO.md

---

## Testing Conventions

- **Unit / component tests**: Jest — colocated as `*.test.ts` / `*.test.tsx` next to source files
- **E2E tests**: [TBD — Detox or Maestro] — in `tests/e2e/`
- **Run unit**: `pnpm test`
- **Run E2E**: `pnpm run test:e2e`
- **Coverage target**: 80% for new features
- E2E tests use screen-based selectors and `testID` props

---

## Environment & Commands

- **Package manager**: pnpm
- `pnpm start` — start Expo dev server
- `pnpm run ios` — run on iOS simulator
- `pnpm run android` — run on Android emulator
- `pnpm test` — unit tests (Jest)
- `pnpm run lint` — Biome lint check
- `pnpm run typecheck` — TypeScript type check

**Required environment variables** (never commit values):
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `OPENROUTER_API_KEY` — OpenRouter API key (server-side only, used in Supabase edge functions)

---

## Key Documentation

@docs/technical/ARCHITECTURE.md
@docs/technical/DECISIONS.md
@docs/technical/API.md
@docs/technical/DATABASE.md
@docs/user/USER_GUIDE.md

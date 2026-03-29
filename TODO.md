# TODO / Backlog

> **Governor**: @project-manager — invoke for sprint planning, prioritization, and feature breakdown
> **Agents**: May add items to "Backlog" and move completed items to "Completed". Preserve section order. Never reorder items within a section — priority position is set by humans or @project-manager when explicitly asked.

---

## In Progress

*(nothing currently in progress)*

---

## Up Next (prioritized)

- [ ] #018 — AI I/O observability via Supabase logging: architecture + ADR/DECISIONS + ARCHITECTURE [area: infra] → [.tasks/018-ai-io-observability-architecture.md](.tasks/018-ai-io-observability-architecture.md)
- [ ] #019 — Instrument transcribe, assign-topics, shared OpenRouter code with structured logging; never log audio bodies [area: backend] → [.tasks/019-edge-function-logging-instrumentation.md](.tasks/019-edge-function-logging-instrumentation.md)
- [ ] #020 — Update API.md (and brief ops note if appropriate) for logging visibility and privacy [area: docs] → [.tasks/020-api-docs-logging-privacy.md](.tasks/020-api-docs-logging-privacy.md)
- [ ] #021 — Tests asserting logging omits audio and matches expected structure where testable [area: qa] → [.tasks/021-logging-privacy-tests.md](.tasks/021-logging-privacy-tests.md)

---

## Backlog

- [ ] #010 — Complete thought detail / journaling (minimal screen shipped in inbox — see task) [area: mobile] → [.tasks/010-thought-detail-screen.md](.tasks/010-thought-detail-screen.md)
- [ ] #012 — Build daily check-in screen [area: mobile] → [.tasks/012-daily-checkin-screen.md](.tasks/012-daily-checkin-screen.md)
- [ ] #013 — E2E tests for authentication flow [area: qa] → [.tasks/013-e2e-auth-tests.md](.tasks/013-e2e-auth-tests.md)
- [ ] #014 — E2E tests for thought capture flow [area: qa] → [.tasks/014-e2e-capture-tests.md](.tasks/014-e2e-capture-tests.md)
- [ ] #015 — CI/CD pipeline for Expo builds (GitHub Actions) [area: infra] → [.tasks/015-cicd-pipeline.md](.tasks/015-cicd-pipeline.md)

---

## Completed

- [x] #000 — Initial project setup and template configuration → [.tasks/000-initial-project-setup.md](.tasks/000-initial-project-setup.md)
- [x] #001 — Design database schema (thoughts, tags, daily_checkins) [area: database] → [.tasks/001-database-schema.md](.tasks/001-database-schema.md)
- [x] #002 — Initialize Expo project with navigation and Supabase client [area: mobile] → [.tasks/002-expo-project-init.md](.tasks/002-expo-project-init.md)
- [x] #003 — Configure Supabase project (tables, RLS policies, auth settings) [area: backend] → [.tasks/003-supabase-config.md](.tasks/003-supabase-config.md)
- [x] #004 — Implement design system tokens and base components [area: design] → [.tasks/004-design-system-tokens.md](.tasks/004-design-system-tokens.md)
- [x] #005 — Build user authentication screens (sign up, sign in, password reset) [area: mobile] → [.tasks/005-auth-screens.md](.tasks/005-auth-screens.md)
- [x] #006 — Build quick capture screen (text input + voice recording UI) [area: mobile] → [.tasks/006-quick-capture-screen.md](.tasks/006-quick-capture-screen.md)
- [x] #007 — Integrate OpenRouter for voice transcription [area: backend] → [.tasks/007-openrouter-transcription.md](.tasks/007-openrouter-transcription.md)
- [x] #008 — Implement AI auto-tagging via OpenRouter [area: backend] → [.tasks/008-ai-auto-tagging.md](.tasks/008-ai-auto-tagging.md)
- [x] #009 — Build thought inbox screen [area: mobile] → [.tasks/009-thought-inbox-screen.md](.tasks/009-thought-inbox-screen.md)
- [x] #011 — Build library / topic browse view (folder grid + add topic) [area: mobile] → [.tasks/011-library-browse-screen.md](.tasks/011-library-browse-screen.md)
- [x] #016 — User-scoped topics schema (user_topics, thought_topics, tags→topics) [area: database] → [.tasks/016-user-topics-schema.md](.tasks/016-user-topics-schema.md)
- [x] #017 — assign-topics edge function + transcribe pipeline + mobile wiring [area: backend] → [.tasks/017-assign-topics-pipeline.md](.tasks/017-assign-topics-pipeline.md)

---

## Item Format Guide

When adding new items, use this format:

```
- [ ] #NNN — Brief description of the task [area: frontend|backend|database|qa|docs|infra|design|mobile] → [.tasks/NNN-short-title.md](.tasks/NNN-short-title.md)
```

Every TODO item must have a corresponding `.tasks/NNN-*.md` file. @project-manager creates both together.

**Area tags** help agents know which specialist to use:
- `mobile` → @react-native-developer
- `frontend` → @frontend-developer
- `backend` → @backend-developer
- `database` → @database-expert
- `design` → @ui-ux-designer
- `qa` → @qa-engineer
- `docs` → @documentation-writer
- `infra` → @systems-architect / @cicd-engineer
- `setup` → general

**Priority**: Items higher in "Up Next" are higher priority. Agents move completed items to "Completed" and may add new items to "Backlog". Only humans reorder items within a section to change priority, unless explicitly asked to reprioritize.

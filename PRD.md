# Product Requirements Document

> [!IMPORTANT]
> This document is the source of truth for what we are building.
> Claude agents must READ this document to understand requirements.
> **Edits require explicit human approval in the current conversation** (see project `CLAUDE.md`). Do not rewrite or sync to implementation on your own initiative.
> When in doubt, leave it unchanged and ask the human.

---

**Version**: 1.2
**Status**: Active (development — beta scope in progress)
**Last updated by human**: 2026-03-30
**Product owner**: Josip

---

## 1. Executive Summary

Sanctuary is a mobile app (React Native/Expo) that gives individuals a calm, friction-free space to capture and reflect on their thoughts. Users record anything — an idea, a feeling, a grocery list, a voice memo — and AI (via OpenRouter) transcribes voice capture and assigns a **topic** from each user’s personal topic list (or creates a new topic when nothing fits well enough). The **v1** product also targets journaling (including an extended reflection field), daily check-ins for mood tracking, inbox search and topic filters, AI reflection prompts on the thought detail screen, and an organized inbox and library. **As of the current build**, the capture loop, inbox, and library-by-topic are implemented; thought detail, search/filter, check-ins, and reflection prompts remain to reach full v1 (see §8). Sanctuary is designed as the antithesis of "hustle-culture" productivity apps: serene, spacious, and intentional. The target audience is individuals seeking calm and clarity who want to stop losing fleeting thoughts and start building a personal reflection practice.

---

## 2. Problem Statement

### 2.1 Current Situation

People with active minds constantly lose valuable thoughts. They use a fragmented mix of tools — voice memos, notes apps, messaging themselves, paper notebooks — each with its own friction, none connected, and none designed for reflection. Check-ins and journaling happen in separate apps (if at all), disconnected from the raw captures that prompted them.

### 2.2 The Problem

The moment a thought arrives and the moment you have time to act on it are rarely the same. Existing capture tools require too much setup (titling, categorizing, opening the right app). Existing journaling apps require too much intent upfront. The result: thoughts are lost, or captured but never revisited, because no tool bridges the gap between quick capture and meaningful reflection.

### 2.3 Why Now

Voice transcription has become fast and affordable via APIs. AI-assisted labeling (topics, prompts, summarization) is mature enough to be genuinely useful without being invasive. Mindfulness and digital wellness are mainstream concerns — there is clear user demand for intentional, calm alternatives to engagement-optimized apps. The tooling (Expo, Supabase, OpenRouter) now makes a high-quality mobile app achievable by a small team without backend infrastructure overhead.

---

## 3. Goals & Success Metrics

### 3.1 Business Goals

- Deliver a working, polished friends-and-family beta that validates the core capture + reflection loop
- Establish the design system and architecture foundation for future features (notifications, sharing); **AI reflection prompts** are in-scope for v1 but not yet shipped (see §8)
- Gather qualitative feedback from beta users to inform v2 prioritization

### 3.2 Success Metrics

| Metric | Baseline | Target | How Measured |
|--------|----------|--------|--------------|
| Daily active users (beta) | 0 | 5+ consistent daily users | Supabase analytics |
| Thoughts captured per user per week | 0 | 10+ | Database query |
| Onboarding completion rate | 0% | 80% (sign up → first capture) | Event tracking |
| Voice capture usage | 0% | 30%+ of captures are voice | Database query |

---

## 4. User Personas

### Persona: The Quiet Thinker

- **Role**: Individual with an active mind — could be any profession
- **Goals**: Offload thoughts quickly before they disappear; reduce mental clutter; feel calmer knowing ideas are safely stored
- **Pain points**: Loses thoughts constantly because capture is too slow; hates titling and categorizing before saving; existing apps feel overwhelming
- **Technical level**: Non-technical
- **Usage frequency**: Multiple times daily (quick captures), weekly (browsing/reflection)

### Persona: The Reflective Journaler

- **Role**: Someone with an existing journaling practice looking for a digital-first, AI-assisted upgrade
- **Goals**: Capture + revisit thoughts in one place; use AI prompts to go deeper; build a searchable personal knowledge base over time
- **Pain points**: Journaling apps require intent upfront; notes apps don't support reflection; voice memos are unsearchable
- **Technical level**: Moderate
- **Usage frequency**: Daily (morning check-in + captures), weekly (deep journaling sessions)

---

## 5. Functional Requirements

> Requirements are numbered FR-XXX for unambiguous cross-referencing by agents and in tests.

### 5.1 Authentication

- **FR-001**: Users must be able to register with an email address and password
- **FR-002**: Users must be able to log in with existing email and password credentials
- **FR-003**: Users must be able to request a password reset via email
- **FR-004**: Authenticated sessions must persist across app restarts (no re-login required until session expires)
- **FR-005**: Users must be able to log out, which terminates the local session

### 5.2 Thought Capture

- **FR-010**: Users must be able to capture a thought as free-form text from a persistent quick-access screen
- **FR-011**: Users must be able to record a voice message as an alternative to typing
- **FR-012**: Voice recordings must be automatically transcribed to text using an OpenRouter-routed AI model
- **FR-013**: Each captured thought must be automatically assigned **one primary topic** by AI. Topics are **per user**: stored in the user’s topic catalog in the database. The model sees the user’s existing topics and should **prefer reusing** an existing topic when it is a strong match; when no existing topic is a sufficient match, the system **creates a new topic** and assigns the thought to it (see ADR-002 / technical docs for the match-threshold rule)
- **FR-014**: Capture must not restrict content type — any text or voice input is accepted without categorization required from the user
- **FR-015**: Every captured thought must be associated with the authenticated user's account
- **FR-016**: Capture must succeed and persist the raw text (or empty body + pending transcription for voice) immediately; AI transcription (voice) and **topic assignment** may complete asynchronously after capture. For voice, topic assignment runs in the same server pipeline as transcription after the transcript is saved; for text capture, topic assignment is triggered separately but still asynchronous from the user’s perspective

### 5.3 Thought Inbox & Library

- **FR-020**: Users must be able to view all their captured thoughts in a chronological inbox view, newest first
- **FR-021**: Users must be able to filter the inbox/library by **topic** (AI-assigned or manually adjusted in detail view)
- **FR-022**: Users must be able to search thoughts by keyword across the full text content
- **FR-023**: Users must be able to browse thoughts organized by **topic** in a library view

### 5.4 Thought Detail & Journaling

- **FR-030**: Users must be able to open any captured thought and expand it into a longer, free-form text entry (journaling)
- **FR-031**: Users must be able to edit the text of any captured thought
- **FR-032**: Users must be able to delete a thought (with confirmation)
- **FR-033**: The thought detail view must display the auto-assigned **topic** and allow the user to change it manually (including picking another existing topic or creating a new one, consistent with the per-user topic catalog)
- **FR-034**: Users must be able to request an AI-generated reflection prompt for any thought, displayed inline in the detail view

### 5.5 Daily Check-in

- **FR-040**: Users must be able to complete a daily check-in that captures their current mood or emotional state
- **FR-041**: Users must be able to set a daily intention or theme as part of the check-in
- **FR-042**: Daily check-in history must be accessible and browsable in the library view
- **FR-043**: Only one check-in per calendar day is permitted; opening the check-in screen on an existing day loads the existing entry for editing

---

## 6. Non-Functional Requirements

### Performance
- App startup (cold launch) must complete within 3 seconds on mid-range devices
- UI transitions must maintain 60fps
- Thought capture (text submission) must complete in < 500ms from user action to confirmation

### Security
- Authentication required for all data access — no unauthenticated reads or writes
- Supabase Row Level Security (RLS) must be enabled on all tables so users can only access their own data
- `OPENROUTER_API_KEY` must never be exposed client-side — only used in Supabase Edge Functions
- No user data stored in device logs or analytics payloads

### Accessibility
- WCAG 2.1 AA compliance for all screens
- Minimum tap target size: 44×44pt
- All interactive elements must have accessible labels

### Platform Support
- iOS 16+ and Android 10+ (API level 29+)
- Tested on both physical devices and simulators (ongoing)
- Expo Go compatible during development; **production builds** use EAS (CI pipeline for PRs still on backlog)

### Reliability
- Supabase-managed uptime SLA applies
- Failed AI **topic assignment** must not block capture — thoughts are saved regardless of AI availability

---

## 7. Out of Scope (v1.0)

The following will **not** be built in the initial version:

- **Social / sharing features** — no sharing thoughts with others, no community feed
- **Paid subscription / billing** — no paywall, no in-app purchases
- **Push notifications / reminders** — no scheduled nudges or streaks
- **Web app** — mobile only; no browser version
- **Apple Sign-In / Google Sign-In** — email + password auth only
- **Team or multi-user spaces** — single-user only
- **Offline-first sync** — app requires connectivity; offline support deferred to v2

---

## 8. Current implementation status

> **Informative only** — requirements in §5 remain the v1 target. This section tracks what the repository ships **today** so agents and stakeholders do not assume unfinished features are live.

**Last synced with codebase**: 2026-03-30

| Capability | FR refs | Status | Notes |
|------------|---------|--------|--------|
| Email auth (sign up, sign in, reset, session, sign out) | FR-001–005 | **Shipped** | Supabase Auth |
| Quick capture — text and voice | FR-010, FR-011, FR-014, FR-015 | **Shipped** | Voice sent to edge function for transcription; not stored in Supabase Storage |
| Voice transcription + topic assignment pipeline | FR-012, FR-013, FR-016 | **Shipped** | `/transcribe` then shared assign-topics logic; text capture uses `/assign-topics` |
| Inbox — chronological list, newest first | FR-020 | **Shipped** | Paginated list, pull-to-refresh |
| Inbox — filter by topic | FR-021 | **Not started** | Topic browsing is via **Library** (tap a topic); inbox has no topic filter UI |
| Inbox / library — keyword search | FR-022 | **Not started** | No search field on inbox |
| Library — browse by topic | FR-023 | **Shipped** | Folder-style topic grid, topic detail list, manage lists (add topic) |
| Thought detail — view | — | **Shipped** | Stack screen from inbox |
| Thought detail — edit primary text | FR-031 | **Shipped** | Edits `body` only |
| Thought detail — extended journaling field | FR-030 | **Not started** | `body_extended` exists in schema; no UI |
| Thought detail — delete with confirmation | FR-032 | **Shipped** | |
| Thought detail — change topic manually | FR-033 | **Not started** | Topics shown read-only |
| Thought detail — AI reflection prompt | FR-034 | **Not started** | `reflection-prompt` edge function is specified in `docs/technical/API.md` but not implemented end-to-end |
| Daily check-in (mood, intention, one per day, history in library) | FR-040–043 | **Not started** | `daily_checkins` table and RLS exist; no check-in screen or library history section |
| Automated E2E tests | — | **Not started** | Framework choice still open (see §9) |
| PR CI (lint, typecheck, unit tests) | — | **Not started** | Backlog |

**Summary**: Core **capture → inbox → library by topic** is usable. Remaining v1 gaps for a PRD-complete beta: thought detail parity (extended journal, topic edit, reflection prompt), inbox search and topic filter (or an explicit product decision to meet FR-021/022 only via library patterns), daily check-in UI + library history, and quality gates (CI, E2E).

---

## 9. Open Questions

> Decisions that are still open or only partially settled. Resolved defaults are documented in `docs/technical/API.md` and edge function env vars.

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Which OpenRouter model for voice transcription long-term? | Josip | **Default in code**: `OPENROUTER_TRANSCRIPTION_MODEL` with fallback `google/gemini-2.0-flash-001` (multimodal). Operators may override via secret. |
| 2 | Which OpenRouter model(s) for topic assignment and (future) reflection prompts? | Josip | **Default in code**: `OPENROUTER_TOPIC_MODEL` or `OPENROUTER_TAGGING_MODEL`, fallback `google/gemini-2.0-flash-001`. Reflection-prompt endpoint not deployed yet. |
| 3 | E2E test framework: Detox or Maestro? | Josip | Open |
| 4 | Should voice audio files be stored in Supabase Storage, or only the transcript? | Josip | **Resolved: transcripts only — audio stored locally on device, never uploaded** |

---

## 10. Revision History

> Human-owned changelog. Agents add entries only when the human has directed a PRD update in-session.

| Date | Author | Change Description |
|------|--------|--------------------|
| 2026-03-28 | Josip | Initial draft — onboarding complete |
| 2026-03-28 | Josip | v1.1 — FR-013/016/021/023/033 and reliability: user-scoped **topics** (one per thought), reuse-vs-create behavior, pipeline notes; executive summary and open questions aligned |
| 2026-03-30 | Josip | v1.2 — §8 implementation status vs repo; executive summary and §3.1 aligned with shipped vs pending; §9 open questions updated for documented model defaults; §6 platform note on CI |

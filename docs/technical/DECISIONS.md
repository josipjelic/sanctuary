<!--
DOCUMENT METADATA
Owner: @systems-architect
Update trigger: Any significant architectural, technology, or design pattern decision is made
Update scope: Append new ADRs only. Never edit the body of an Accepted ADR.
Read by: All agents. Check this file before proposing changes that may conflict with prior decisions.
-->

# Architecture Decision Records

> This log captures the context and reasoning behind key decisions so they are never lost.
>
> **Rule**: Once an ADR is marked **Accepted**, do not edit its body. If a decision needs to change, write a new ADR that explicitly supersedes the old one. Add `**Status**: Superseded by ADR-XXX` to the old record.
>
> **Agents**: Read the relevant ADRs before proposing architectural changes. A proposal that contradicts an Accepted ADR needs a new ADR — not a silent override.

---

## Decision Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| ADR-001 | Expo + Supabase + OpenRouter stack selection | Accepted | 2026-03-28 |
| ADR-002 | User-scoped topics, match threshold, transcribe pipeline | Accepted | 2026-03-28 |
| ADR-003 | AI I/O observability via Supabase Edge Function logs | Accepted | 2026-03-30 |
| ADR-004 | AI reminder detection and client-side local notification scheduling | Accepted | 2026-03-30 |
| ADR-005 | OCEAN personality onboarding and morning messages architecture | Accepted | 2026-04-11 |
| ADR-006 | AI-guided journal, user state memory, and evening reminder | Superseded by ADR-007 | 2026-04-11 |
| ADR-007 | Revert the AI-guided journal feature | Accepted | 2026-07-13 |

---

## ADR-001: Expo + Supabase + OpenRouter Stack Selection

**Date**: 2026-03-28
**Status**: Accepted

### Context

Sanctuary is a mobile-first personal app built by a solo developer (Josip). The primary concerns are:
- Fast iteration speed — get to a working prototype quickly
- Minimal infrastructure overhead — no custom servers to manage
- Cross-platform from day one — iOS and Android
- AI capabilities (transcription, tagging) without building ML infrastructure
- Cost-effective for an early-stage, non-commercial beta

The app needs auth, a relational database with per-user data isolation, file storage for voice recordings, and AI-powered text processing.

### Options Considered

**Option 1: Expo + Supabase + OpenRouter (chosen)**
- Expo: managed React Native workflow, cross-platform, Expo Go for fast device testing
- Supabase: PostgreSQL with RLS for per-user isolation, auth, storage, and edge functions in one service
- OpenRouter: model-flexible AI proxy — test different models without code changes

**Option 2: Expo + Firebase**
- Firebase provides auth, Firestore (NoSQL), and storage
- Firestore is document-oriented — less suited for relational queries (e.g., filtering thoughts by tag + date)
- NoSQL makes schema evolution harder; PostgreSQL + RLS is more expressive
- Firebase edge functions are Cloud Functions — more setup than Supabase edge functions

**Option 3: Expo + custom Node.js/Express API**
- Full control over the backend
- Significantly more setup and maintenance overhead for a solo project
- Auth, DB, storage all require separate services (e.g., Auth0, Neon, S3)
- Not justified for v1 scope

### Decision

**Expo + Supabase + OpenRouter.**

Supabase eliminates the need for a custom server while providing a production-grade PostgreSQL database, RLS for security, auth, and storage in a single managed service. Expo provides the fastest path to a working cross-platform React Native app. OpenRouter provides model flexibility for AI features without locking into a single provider — particularly valuable while the right model for transcription and tagging is still being evaluated (see PRD open questions).

### Consequences

**What this makes easy:**
- Auth, database, storage, and edge functions are available immediately from one Supabase project
- RLS handles per-user data isolation at the database level — no application-layer access control needed
- OpenRouter allows swapping AI models via config, not code changes
- No servers to provision, monitor, or scale for v1

**Trade-offs accepted:**
- Locked into Supabase's pricing and limits at scale — acceptable for a beta; evaluate at v2
- Edge functions add ~50ms cold-start latency vs a warm API server — acceptable for async AI operations
- Supabase free tier has 500MB database and 1GB storage limits — sufficient for beta
- OpenRouter adds a proxy layer vs calling models directly — slight cost overhead, justified by flexibility

---

## ADR-002: User-Scoped Topics, Match Threshold, Transcribe Pipeline

**Date**: 2026-03-28
**Status**: Accepted

### Context

Early v1 stored free-form labels on each thought as `thoughts.tags` (`text[]`) with no per-user vocabulary. AI tagging did not see prior labels, causing inconsistent duplicates (“grocery” vs “groceries”). The product direction is **topics** (user-owned catalog), **one primary topic per thought**, reuse when the model is confident, and **voice** flows that do not require a second client round-trip after transcription.

### Decision

1. **Schema**: `user_topics` (per-user catalog) and `thought_topics` (junction). Denormalized `thoughts.topics` (`text[]`, renamed from `tags`) for simple inbox queries and `@>` filters.
2. **Threshold**: The model returns structured JSON including `best_match_score` (0–1). The server reuses an existing topic only when `best_match_score` **>** **0.2** and `best_existing_normalized_name` matches a catalog row; otherwise it creates a new `user_topics` row from `new_topic`.
3. **Pipeline**: Topic assignment runs **inside** `transcribe` immediately after a successful transcript write. Typed capture calls a separate `assign-topics` edge function that imports the same shared Deno module (`supabase/functions/_shared/assign-topics.ts`).
4. **Naming**: Product and schema use **topics**; `tagging_status` is retained for less migration churn (it tracks topic assignment lifecycle).

### Consequences

- One OpenRouter call chain per voice capture for transcribe + topics (higher latency than split calls, fewer client failures).
- Reuse quality depends on model calibration of `best_match_score`; prompts and monitoring may need iteration.
- PRD v1.1 describes topics at the requirement level; implementation detail and threshold live in ADR-002 and `docs/technical/ARCHITECTURE.md`.

---

## ADR-003: AI I/O Observability via Supabase Edge Function Logs

**Date**: 2026-03-30
**Status**: Accepted
**Deciders**: Orchestrated task (feature/ai-supabase-logging), @systems-architect

### Context

Operators need visibility into AI-related edge operations (transcription, topic assignment) for debugging and incident response. The product must not widen the attack surface or violate privacy: **raw voice must never appear in logs**, and secrets must never leak. The PRD security NFR states that **no user data** is stored in **device** logs or **analytics** payloads — the scope of that rule must be reconciled with legitimate **server-side** operational logging.

### Options Considered

1. **Dedicated Postgres audit table for AI I/O** — Persist structured rows (request/response metadata, correlation IDs) in a new table. — Pros: queryable in SQL, long retention if we control it, joins with `thoughts`. Cons: new schema, RLS/privacy review, storage growth, not the platform’s native operator view; higher implementation and compliance surface than needed for v1.

2. **Supabase Edge Function logs (`console` → project logs / dashboard)** — Emit structured, JSON-serializable log lines from edge functions; operators use Supabase-hosted log UI and exports. — Pros: no new tables, aligns with Deno/Supabase runtime, minimal moving parts, credentials stay in existing secret model. Cons: retention and search UX are **platform-managed** (no promise of indefinite retention); advanced analytics require export or a future ADR.

3. **Third-party APM/log aggregation (e.g. Datadog, Axiom) wired from Edge** — Forward logs to an external sink. — Pros: powerful retention, alerting, dashboards. Cons: extra vendor, cost, secret handling for ingest keys, and operational overhead — disproportionate for current scale.

### Decision

Use **Supabase Edge Function logging only** for AI I/O observability in v1: structured log events from `transcribe`, `assign-topics`, and shared OpenRouter/topic helpers (implementation: task #019, @backend-developer). **Do not** add a Postgres audit table for this purpose unless a future ADR revisits the trade-off.

**Reconciliation with PRD (Security, NFR section):** The NFR *“No user data stored in device logs or analytics payloads”* applies to the **mobile client** and **client-sent analytics** — the app must not write thought content, transcripts, or PII into on-device logs or third-party analytics SDK payloads. **Server-side** Edge Function logs used strictly for operating the AI pipeline are **in scope** and **not** a violation of that NFR, provided redaction rules in `docs/technical/ARCHITECTURE.md` are followed (no raw audio, no secrets, no full multipart bodies).

### Consequences

- **Positive**: Single place for operators to tail AI operations (Supabase dashboard); no migration or RLS policy set for a new audit table; implementation stays inside existing edge functions.
- **Negative**: Log retention, indexing, and export behavior follow Supabase platform limits and changes — document that we **do not** rely on logs as a durable compliance archive; use DB state for authoritative user data.
- **Neutral**: If v1 outgrows dashboard logs, a follow-up ADR may add export or a vendor without changing the core “no raw audio / no secrets” rules.

---

## ADR-004: AI Reminder Detection and Client-Side Local Notification Scheduling

**Date**: 2026-03-30
**Status**: Accepted
**Deciders**: Josip / @systems-architect

### Context

Users frequently capture thoughts that contain future time references (“call mum next Monday”, “dentist Wednesday at 3 pm”, “submit report by Friday”). These implicit reminders are currently lost -- Sanctuary captures the text but never surfaces the time-sensitive intent back to the user.

The product owner has directed adding a reminders subsystem even though PRD v1.0 section 7 listed “push notifications / reminders” as out of scope. The goal is an AI-detected, user-approved reminder workflow: the system detects temporal references in captured thoughts, proposes a reminder, and -- only after the user explicitly approves -- schedules a notification.

**Constraints that shape the design:**

- **Expo managed workflow (SDK 54)**: Rules out direct APNs/FCM registration; the standard path is `expo-notifications`.
- **Solo developer, beta phase**: Infrastructure complexity must stay minimal. Supabase is the only backend; there is no custom API server.
- **Non-blocking pipeline**: Reminder detection must not slow down or risk failing the capture response the user sees (thought save + topic assignment). A failed reminder detection must be invisible to the capture flow.
- **User approval required**: No notification may fire without the user explicitly approving the proposed reminder. This is a product requirement, not just a UX preference -- unsolicited notifications would violate the “calm, intentional” brand.
- **Single device for beta**: Multi-device sync is a v2 concern. The beta user base is small and single-device usage is the norm.

### Options Considered

1. **Client-side local notifications via `expo-notifications` (`scheduleNotificationAsync`)** -- At approval time, the mobile app computes the fire time (reminder `scheduled_at` minus the user's preferred lead time) and schedules a local notification on the device. No server-side scheduling infrastructure required.
   - **Pros**: Zero additional infrastructure. Works offline once scheduled. Native to Expo managed workflow -- `expo-notifications` handles APNs/FCM registration, permission prompts, and local scheduling in one package. Simple to implement: one `scheduleNotificationAsync` call per approved reminder. The scheduled notification survives app termination (OS-managed). Lead-time computation is trivial client-side arithmetic. No new secrets, no cron jobs, no external services.
   - **Cons**: Notifications are device-local -- if the user switches devices or reinstalls, scheduled reminders are lost (acceptable for a single-device beta). iOS may throttle or defer local notifications under battery optimization in rare edge cases. No server-side record of whether the notification actually fired. Rescheduling (if the user edits the reminder time) requires canceling the old notification identifier and scheduling a new one -- manageable but the client must track the `notificationId`.

2. **Server-side scheduling with `pg_cron` + Expo Push API** -- A PostgreSQL cron job (via Supabase `pg_cron` extension) polls the `reminders` table periodically (e.g. every minute), finds reminders due within the next window, and calls an edge function that sends push notifications via the Expo Push API using stored push tokens.
   - **Pros**: Notifications are server-authoritative -- survives device changes if the push token is refreshed. Centralized scheduling logic; the client does not need to manage local notification identifiers. Enables multi-device delivery in the future.
   - **Cons**: Requires Supabase Pro plan for `pg_cron` (not available on free tier). Requires storing Expo push tokens in a new table and managing token lifecycle (expiry, refresh, revocation). Requires a new edge function to send push notifications. Adds a polling loop that runs continuously even when no reminders are due -- wasteful at beta scale. Significant implementation complexity for a solo developer: push token table, cron schedule, edge function, error handling for invalid tokens, Expo Push API receipts. Introduces a server-side dependency for a feature that is not yet validated with users.

3. **External cron (e.g. GitHub Actions scheduled workflow) + Supabase Edge Function + Expo Push API** -- An external scheduler triggers a Supabase edge function on a fixed interval; that function queries due reminders and sends push notifications via the Expo Push API.
   - **Pros**: Does not require `pg_cron` or Supabase Pro. Can use any external cron provider (GitHub Actions, Cloudflare Workers Cron Triggers, etc.).
   - **Cons**: All the same push-token and edge-function complexity as Option 2, plus an external service dependency. GitHub Actions cron has minimum 5-minute granularity and is not guaranteed to run on time. Adds a secret (Supabase service role key or function invoke key) to the external cron environment. More moving parts than either other option for less reliability.

### Decision

**Option 1: Client-side local notifications via `expo-notifications`.**

For a single-device beta with a solo developer, this is the correct trade-off. It adds zero infrastructure, works within the Expo managed workflow, and delivers the core user value (a notification fires at the right time on the user's device) without the operational burden of server-side scheduling. The reminder row in PostgreSQL is the source of truth for reminder state (detected, approved, dismissed, fired); the local notification is a delivery mechanism only.

**Push notification provider**: `expo-notifications` (the standard Expo managed-workflow package). It handles APNs (iOS) and FCM (Android) registration transparently, supports both local and remote push notifications, and provides `scheduleNotificationAsync` for time-based local scheduling. No direct APNs/FCM integration is needed.

**AI detection pipeline placement**: A new shared module `supabase/functions/_shared/detect-reminders.ts` runs **after** `assign-topics` completes (or fails) in both the `transcribe` and `assign-topics` edge functions. It is invoked with a **fire-and-forget** pattern: `detectReminders(...).catch(() => {})` -- the promise is not awaited in the response path. This means:
- The HTTP response to the client is returned as soon as topic assignment finishes (same as today).
- Reminder detection runs in the background of the same Deno isolate invocation. If it fails, the capture response is unaffected.
- `reminder_detection_status` on the `thoughts` row tracks the outcome (`none`, `pending`, `detected`, `no_reminder`, `failed`).

**Notification lead time**: The user sets a global preference stored in a `user_preferences` table (or a `notification_lead_time` column on an existing user-settings surface): `15min`, `30min`, `1hour`, or `morning` (with a configurable morning time, default 08:00 local). At approval time, the client computes: fire time = `scheduled_at - lead_time` (or morning-of for `morning` preset). The `notificationId` returned by `scheduleNotificationAsync` is stored on the `reminders` row so the client can cancel or reschedule.

**Upgrade path to server-side (v2)**: If multi-device sync or higher reliability is needed, a future ADR can add Expo Push API delivery from a server-side scheduler (Option 2 or 3) without changing the data model. The `reminders` table already stores `scheduled_at` and status -- a server-side job would query the same table. The client would stop calling `scheduleNotificationAsync` and instead register its push token. The `expo-notifications` package supports both local and remote notifications, so the client-side permission and display code remains unchanged.

### Consequences

- **Positive**: No new infrastructure, secrets, or external services. Implementation is contained to: one shared Deno module (AI detection), one migration (two tables), and client-side scheduling logic using a well-supported Expo package. The capture pipeline is not slowed or made less reliable. The data model supports a future server-side upgrade without schema changes.
- **Negative**: Scheduled notifications are device-local and will be lost on reinstall or device switch. There is no server-side confirmation that a notification actually fired. iOS battery optimization may in rare cases delay a local notification by a few minutes. The fire-and-forget pattern for detection means a detection failure is only visible in edge function logs (ADR-003), not in the client response -- operators must monitor logs to catch systemic detection failures.
- **Neutral**: The `reminders` table and `user_preferences` table are new schema additions that will need RLS policies following the existing pattern. The `expo-notifications` package must be added to the Expo project and notification permissions must be requested at an appropriate UX moment (flag for @ui-ux-designer).

---

## ADR-005: OCEAN Personality Onboarding and Morning Messages Architecture

**Date**: 2026-04-11
**Status**: Accepted
**Deciders**: Josip / @systems-architect

### Context

The product direction calls for a simplified pre-v2 variant of the user profiling and morning insight features (FR-060, FR-070–073). Rather than building the full longitudinal memory layer (FR-060–063, scoped to v2 paid tier), this variant captures a static OCEAN (Big Five) personality profile during onboarding and uses it to personalise a daily morning message. Concretely: after sign-up, the user answers 5–7 reflective questions; an AI scores their answers into the five OCEAN dimensions (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism); the profile is stored in Supabase; a daily morning message is generated from the profile and delivered as both a local notification nudge and an in-app card on the Quick Capture screen.

Four decisions are recorded together here because they form a single coherent subsystem and each constrains the others.

**Constraints that shape all four decisions**:
- No custom servers (ADR-001); all logic runs in the mobile app or Supabase Edge Functions.
- Client-side local notifications via `expo-notifications` (ADR-004); server-side scheduling requires Supabase Pro (unavailable on free tier).
- `user_preferences` key-value table already exists; `morning_notification_time` key (default `07:30`) is already in use.
- FR-073 mandates that the morning insight delivery mechanism uses the existing `expo-notifications` infrastructure.
- Beta scale — operational complexity must stay minimal; the per-user cost of a single onboarding AI call is negligible.

---

### Decision 1 of 4 — OCEAN Scoring Approach

#### Options Considered

1. **AI-analysed free-text via OpenRouter** — Users write reflective answers in their own words. A new `score-ocean-profile` edge function sends the full answer set to OpenRouter with a structured-output prompt. The model returns a JSON object `{ openness, conscientiousness, extraversion, agreeableness, neuroticism }` with values 0.0–1.0. The result is stored in a new `ocean_profiles` table (one row per user, upsert). — Pros: Aligns with the Sanctuary brand of reflective capture in the user's own voice; no quantitative scale UI; reuses the existing OpenRouter edge-function pattern with no new vendor; one-time AI call per user (onboarding only); richer linguistic signal enables more nuanced scores; easy to localise. Cons: LLM output is probabilistic — the same answers may yield slightly different scores on repeat runs; not a clinically validated instrument; adds ~1–2 s latency during onboarding (acceptable behind a "Analysing your answers…" screen); negligible cost (~$0.001–0.003 per user at beta scale).

2. **Pre-mapped Likert scale (algorithmic scoring)** — Each question uses a 1–5 agreement scale with known loading weights per OCEAN dimension (e.g. from the BFI-2 instrument). Scoring is pure arithmetic: weighted sum per dimension, normalized to 0–1. — Pros: Deterministic and reproducible; zero AI cost; no latency; psychometrically validated item sets exist. Cons: Numeric scales contradict the Sanctuary brand ("Speak your mind" vs. "Rate yourself 1–5"); clinical language reduces perceived value; importing a validated item set has licensing implications; cannot capture nuanced or contextual signal.

3. **Hybrid — reflective questions with a sentiment anchor per question** — Users write free text and also tap a simple sentiment indicator (positive/neutral/negative). The Likert value provides a fallback score when AI scoring fails. — Pros: Graceful degradation path; combines rich language signal with a deterministic floor. Cons: Two input mechanisms per question add cognitive load; the UX complexity is disproportionate to a beta feature; having two scoring paths creates ambiguity about which score is "real" and complicates future iteration.

#### Decision

**Option 1 (AI-analysed free-text)**. The reflective free-text approach is consistent with how Sanctuary already captures voice and text thoughts. At beta scale the per-user AI cost is negligible, the one-time latency is acceptable behind a loading screen, and the approximate nature of AI-derived scores is appropriate for a personalisation use case (not clinical assessment). Model resolution follows the existing pattern: `OPENROUTER_OCEAN_MODEL` env var → `OPENROUTER_TOPIC_MODEL` → `google/gemini-2.5-flash-lite` as default.

The edge function sends all answers in a single OpenRouter call with a structured-output prompt. The prompt instructs the model to reason about each dimension independently and return scores as floats between 0.0 and 1.0. Raw answers are stored in an `answers` JSONB column alongside the scores so the profile can be re-scored if the prompt is improved in future.

---

### Decision 2 of 4 — Morning Message Delivery Mechanism

#### Options Considered

1. **App-open card only (lazy in-app generation)** — When the user opens the app during the morning window (after `morning_notification_time`, before noon), check whether a message exists in `morning_messages` for today's date. If not, call `generate-morning-message` edge function; cache result; display as a card at the top of the Quick Capture screen. — Pros: Zero scheduling complexity; no additional notification permissions; message is always freshly generated; no pre-generation pipeline needed. Cons: Purely passive — the message is only seen if the user opens the app unprompted; **fails FR-073**, which mandates `expo-notifications` for insight delivery.

2. **Push notification with pre-generated content** — A server-side scheduler (e.g. `pg_cron` or external cron) generates tomorrow's morning message overnight for each user and schedules an Expo push notification with the generated text in the notification body. — Pros: Message delivered without requiring the user to open the app; notification body is personalised. Cons: Requires `pg_cron` (Supabase Pro — unavailable on free tier; see ADR-004); exposes AI-generated personal message content in a push payload (privacy surface); complex generation pipeline with no safe fallback if pre-generation fails; contradicts the beta-scale simplicity constraint.

3. **Hybrid — recurring daily local notification + lazy in-app generated card** — At onboarding completion, schedule a repeating daily local notification via `expo-notifications` `DailyTriggerInput` at `morning_notification_time`. The notification body is generic ("Your morning reflection is ready — open Sanctuary"). When the user taps the notification or opens the app independently during the morning window, the app calls `generate-morning-message`, caches the result in `morning_messages` (keyed by `user_id + date`), and displays it as a card on the Quick Capture screen. If the user updates `morning_notification_time` in settings, cancel the old notification identifier and schedule a new one. — Pros: Satisfies FR-073; aligns with ADR-004 client-side scheduling pattern; no server-side scheduler; AI generation is on-demand (no wasted calls if user does not open the app); notification permission already requested by the reminders feature. Cons: Notification body is generic (not AI-personalised); message is only generated when the app is opened; if user never opens app, message is never generated.

#### Decision

**Option 3 (hybrid)**. Option 1 violates FR-073. Option 2 requires Supabase Pro and a pre-generation pipeline incompatible with the beta-scale constraint. Option 3 satisfies FR-073 within the ADR-004 client-side pattern, adds no new infrastructure, and keeps AI generation lazy (on demand, at most once per day per user).

**Scheduling specifics**: `scheduleNotificationAsync` with `{ type: SchedulableTriggerInputTypes.DAILY, hour, minute, repeats: true }`. The returned notification identifier is stored in `user_preferences` under key `morning_notification_id`. When `morning_notification_time` changes, the old identifier is cancelled before scheduling a new one.

**Morning window**: a message is eligible for display when local time ≥ `morning_notification_time` and < `12:00`. Window cutoff hardcoded to noon in v1; a preference can be added in a future iteration if users request it.

**Daily cache**: `morning_messages` table with a `UNIQUE (user_id, generated_for_date)` constraint. On app-open within the window, the client reads today's row (if present, show cached message; if absent, call edge function and insert). The `shown_at` column is set when the card is rendered so future analytics can measure engagement.

---

### Decision 3 of 4 — Onboarding Route Guard in Expo Router

#### Options Considered

1. **Root `_layout.tsx` redirect, held behind the splash screen** — Extend the root layout (which already holds the splash screen open until fonts are loaded) to also resolve onboarding status before hiding the splash. Read `AsyncStorage` first (fast synchronous-ish read); fall back to querying `ocean_profiles` if the local value is absent. Redirect to `(onboarding)` if incomplete; to `(auth)` if unauthenticated; render `(app)` otherwise. — Pros: Zero visible flash — the splash screen is already held at this exact point; single decision point for all redirects; consistent with existing font-loading hold pattern. Cons: Adds one async operation (AsyncStorage read) to the root layout's bootstrap sequence; root layout grows slightly in responsibility.

2. **`(app)/_layout.tsx` redirect, no splash hold** — The authenticated app shell checks onboarding status on mount. If incomplete, redirects to `(onboarding)`. — Pros: Cleaner separation (auth guard at root, onboarding guard in app shell). Cons: Authenticated-but-unonboarded users see the tab shell render for one frame before the redirect fires — a visible layout flash that undermines the "calm, intentional" brand promise.

3. **`useOnboardingGuard` hook returning `null` until resolved** — A custom hook used in `(app)/_layout.tsx` renders nothing until status is known. Avoids the flash by blocking render. — Pros: Composable and testable in isolation. Cons: Blank white screen is worse UX than the existing splash screen; the hook introduces a second async boundary separate from the root splash hold, creating two potential stall points during bootstrap.

#### Decision

**Option 1 (root layout redirect with splash-screen hold)**. The Expo splash screen is already held open in `src/app/_layout.tsx` until fonts are ready; this is the correct and idiomatic Expo mechanism for preventing bootstrap flashes. Extending the same hold to cover onboarding status requires adding one `AsyncStorage.getItem` call per authenticated app launch — negligible latency (~5 ms typical).

**Implementation contract**:
- `AsyncStorage` key: `sanctuary:onboarding_complete:<userId>` (namespaced by user so the check works correctly after sign-out/sign-in on the same device).
- Cache population: on onboarding completion, write to `ocean_profiles` (server, source of truth) first; on success, write `AsyncStorage` key. On subsequent launches the AsyncStorage hit short-circuits the Supabase query entirely.
- Redirect mechanism: Expo Router `<Redirect href="/(onboarding)" />` (not `router.push`) to ensure no back-stack entry.
- Route group structure:
  ```
  src/app/
    _layout.tsx              # Root: fonts + auth + onboarding guard + splash hold
    (auth)/                  # sign-in, sign-up, forgot-password
    (onboarding)/            # NEW wizard group
      _layout.tsx            # Stack navigator, no tab bar
      index.tsx              # Welcome / intro screen
      questions.tsx          # 5 reflective questions
      scoring.tsx            # "Analysing your answers…" loading state
      complete.tsx           # "You're all set" + first capture CTA
    (app)/                   # Authenticated + onboarded tabs (unchanged)
  ```

---

### Decision 4 of 4 — Question Set

#### Options Considered

1. **Validated BFI-2 Likert items** — Use a subset of items from the validated Big Five Inventory-2 (Soto & John, 2017), adapted to a free-text format. — Pros: Psychometric validity; well-understood scoring properties. Cons: 60-item full scale is impractical; a 5-item subset loses most validity; the "Agree/Disagree" framing is incompatible with free-text; clinical language is misaligned with Sanctuary brand.

2. **Brand-aligned reflective questions (one per OCEAN dimension)** — Author 5 open-ended questions that elicit the type of language strongly correlated with each OCEAN dimension, without explicit quantitative responses. AI scores the resulting free text. — Pros: Brand-consistent; feels like the existing capture UX; gives the scoring LLM sufficient linguistic signal for each dimension; easy to adjust tone without changing the scoring model. Cons: Not a validated instrument; scores are approximate and non-reproducible; question phrasing influences scores (must be iterated).

3. **Scenario-based questions** — Present brief hypothetical scenarios ("Imagine you have a free Saturday…") and ask what the user would do. — Pros: Concrete; predictable answer length. Cons: Hypotheticals feel artificial in a "genuine reflection" context; scenarios introduce cultural and demographic bias; harder to score reliably against OCEAN dimensions than direct reflective prompts.

#### Decision

**Option 2 (brand-aligned reflective questions)**. Sanctuary's UX is built on the premise that reflection in one's own voice is valuable — the question set must feel like a natural extension of that experience, not a personality test. Approximate AI scoring is sufficient for personalising morning message tone; clinical validity is not required.

**Default question set** (5 questions; one per OCEAN dimension):

| # | Dimension | Question |
|---|-----------|---------|
| 1 | Openness | "What's something you've been curious about recently — an idea, a place, or a way of doing things that caught your attention?" |
| 2 | Conscientiousness | "When you think about the things you want to get done, what tends to help you follow through — and what tends to get in the way?" |
| 3 | Extraversion | "How do you tend to recharge after a busy or draining day? Describe what that usually looks like for you." |
| 4 | Agreeableness | "Tell me about someone in your life you feel close to. What do you value most in that relationship?" |
| 5 | Neuroticism | "What's been weighing on your mind lately? When that kind of feeling shows up, how do you usually sit with it?" |

**Optional extensions** (questions 6–7, skippable):

| # | Dimension | Question |
|---|-----------|---------|
| 6 | Openness (depth) | "Is there a creative pursuit, habit, or new way of thinking you've been wanting to explore but haven't made space for yet?" |
| 7 | Conscientiousness (depth) | "Describe a time when you felt really on top of things — organised, clear, in flow. What made that possible?" |

Questions 6–7 are shown after question 5 with a skip affordance ("Two more if you'd like to share — or skip straight to your sanctuary"). The AI scoring edge function scores all answered questions; absent answers for questions 6–7 do not degrade the score for questions 1–5.

The question set is stored as a versioned constant in the client and edge function (`OCEAN_QUESTIONS_V1`). If questions are revised in a future iteration, the `ocean_profiles` table stores the `question_set_version` so profiles can be identified for re-scoring.

---

### Consequences

- **Positive**: OCEAN scoring reuses the existing OpenRouter infrastructure (one edge function, same auth and logging patterns as ADR-003). Morning message delivery satisfies FR-073 using the ADR-004 client-side local notification pattern — no new scheduling infrastructure required. The route guard eliminates onboarding flash by piggybacking on the existing Expo splash-screen hold. Reflective questions are brand-consistent with the existing capture UX and require no third-party survey licensing.
- **Negative**: AI OCEAN scores are approximate and non-reproducible; they must not be presented to users as clinically meaningful assessments. Morning notification content is generic (personalisation is in-app only, not in the push body). Onboarding status check adds one AsyncStorage read to the root layout bootstrap path. Two new tables (`ocean_profiles`, `morning_messages`) and two new edge functions (`score-ocean-profile`, `generate-morning-message`) increase the schema and function surface.
- **Neutral**: A new `(onboarding)` route group is added to the Expo Router structure alongside the existing `(auth)` and `(app)` groups. The `user_preferences` table gains one new key: `morning_notification_id` (the scheduled daily notification identifier, managed alongside the existing `morning_notification_time` key). The `question_set_version` column on `ocean_profiles` enables future question set upgrades without invalidating existing profiles.

---

## ADR-006: AI-Guided Journal, User State Memory, and Evening Reminder

**Date**: 2026-04-11
**Status**: Superseded by ADR-007
**Deciders**: Josip / @systems-architect

### Context

The product roadmap calls for an AI-guided daily journal — a structured, conversational reflection session where the app asks the user up to three open-ended questions and builds a living memory of the user's patterns over time (FR-030, FR-060–063, FR-073). This is a pre-v2 variant: rather than the full longitudinal ML memory layer deferred to the paid tier, the journal writes a synthesised ~200-word third-person analysis (`user_state`) after each session. The analysis is used as context for future sessions and is readable by the user in a "Your profile" screen in Settings — it is never shown mid-session to avoid biasing responses.

Four decisions are recorded together because they form a single coherent subsystem and each constrains the others.

**Constraints that shape all four decisions**:
- No custom servers (ADR-001); all logic runs in the mobile app or Supabase Edge Functions.
- Client-side local notifications via `expo-notifications` (ADR-004); the evening reminder follows the same `DailyTriggerInput` pattern established for the morning notification in ADR-005.
- `user_preferences` table already has a key-value pattern; `morning_notification_id` and `morning_notification_time` are already in use — evening keys follow the same convention.
- AI calls must follow ADR-003 structured logging; journal-specific phases: `"journal_question"` and `"journal_state_update"`.
- Raw journal answers must never appear in logs — only character counts and answer counts (same redaction rule as voice transcripts and raw OCEAN answers).
- Beta scale — operational complexity must remain minimal.

---

### Decision 1 of 4 — AI Conversation Model

#### Context

The journal session is a guided conversation: the app shows a fixed opening question, the user answers, then the app presents up to two AI-generated follow-up questions (three total turns). The AI must contextualise each follow-up on what the user just said and on their long-term `user_state`, while never assuming life details the user has not volunteered in the current or prior sessions. A `done` signal allows the AI to end the session early (fewer than three turns) when no useful follow-up would add value. Max-turns enforcement must be authoritative server-side, not just client-side.

#### Options Considered

1. **Stateless single-shot per turn** — After each answer, the client calls `journal-next-question` with the full turn history from the current session (max 2 completed turns ≈ 300 tokens) plus the user's 200-word `user_state` snapshot. The function returns either the next question or `{ "done": true }`. No conversation state is held server-side between calls. — Pros: Consistent with all existing edge function patterns (stateless, no server-side session affinity); token usage is tightly bounded (turn history never grows beyond 3 turns); easy to reason about and test; server can enforce the 3-turn cap on every call; simple contract the client can rely on. Cons: The full context (turns + user_state) is re-sent on every call — acceptable given the small size (~600 tokens total); every turn requires a network round trip.

2. **Stateful conversation thread** — Maintain a full OpenRouter `messages` array in a DB column, appended on every turn; each call sends the accumulated thread. — Pros: Richer conversational coherence; the model sees its own prior questions verbatim. Cons: Token growth is unbounded if sessions become long; DB becomes coupled to OpenRouter's message schema (leaky abstraction); no meaningful advantage at a fixed 3-turn maximum; harder to swap AI providers.

3. **Two-pass generation** — First OpenRouter call extracts themes from the user's latest answer; second call formulates the next question from themes + user_state. — Pros: Modular prompt design. Cons: Two serial API calls per turn doubles latency (~2–4 s added) with no clear quality benefit at 3-turn depth; added cost; complexity disproportionate to beta scale.

#### Decision

**Option 1 (stateless single-shot per turn)**. The conversation is short (≤ 3 turns), so re-sending the full turn history is cheap. The stateless pattern is consistent with all existing edge functions and makes failure modes simple to reason about.

**Max-turns enforcement (server-authoritative)**: `journal-next-question` counts the number of completed turns in the `turns` array. If `turns.length >= 2` (opening answered + one follow-up answered), the function may return a third question OR `{ "done": true }` per the AI's judgment. If `turns.length >= 3`, the function returns `{ "done": true }` unconditionally, ignoring the AI response. This server-side cap is the authoritative rule; client enforcement is a UX convenience only.

**`done` signal contract**: The function always returns exactly one of two JSON shapes:

```json
{ "question": "string — the next question to present", "turn_index": 1 }
```

```json
{ "done": true }
```

`turn_index` is the 0-based index of the question about to be asked (1 = first follow-up, 2 = second follow-up). The opening question (turn 0) is the client-side constant `JOURNAL_OPENING_QUESTION_V1` — it is never generated by the edge function.

**User state in prompt**: `user_state.content` is passed as read-only context in the system prompt under an explicit constraint: *"Use this profile only as silent background — never mention it directly, never reference facts the user has not brought up in the current session. If unresolved struggles are present, you may check in about them only when the conversation makes it genuinely natural."* This prevents the AI from sounding like it is reading the user's file back at them.

**Session save is awaited**: `journal-save-session` is a standard awaited POST — the client waits for confirmation of persistence before navigating away. The user state update triggered inside `journal-save-session` is fire-and-forget and does not block the save response.

**Model resolution chain**: `OPENROUTER_JOURNAL_MODEL` → `OPENROUTER_TOPIC_MODEL` → `google/gemini-2.5-flash-lite`.

---

### Decision 2 of 4 — User State Update Approach

#### Context

After each completed journal session, a `user_state` row (one per user) must be updated with a ~200-word third-person analysis synthesising everything the user has shared across all sessions to date. This analysis is the memory layer for future journal sessions. The update is non-blocking — it must not slow the session save response. The analysis must only describe what the user has actually shared; it must make no assumptions.

#### Options Considered

1. **Full rebuild from all session history** — After each session, read all `journal_entries` rows for the user across every completed session and prompt the AI to produce a fresh 200-word analysis from scratch. — Pros: Produces the most internally consistent analysis; AI can re-weigh everything on each update. Cons: Token usage grows linearly with session count (unbounded); at 50+ sessions the prompt context could be thousands of tokens, making this increasingly expensive and slow; not viable as a production approach.

2. **Incremental merge** — After each session, read: (a) the current `user_state.content` (~200 words ≈ 300 tokens), and (b) the new session's Q&A pairs only (3 turns × ~100 words ≈ 300 tokens). Prompt the AI to produce an updated analysis that integrates the new information into the existing profile. — Pros: Token usage stays bounded regardless of session count (prior state is always ~200 words; new session is always small); reuses existing OpenRouter infrastructure with no new dependencies; the 200-word constraint naturally compresses session history; consistent with the beta-scale simplicity constraint. Cons: Each update is a delta — accumulated small errors or biases could slowly drift the analysis over many sessions; a corrective full rebuild is not available as a user-facing tool in v1 (it can be added as an admin utility later).

3. **Vector embeddings + retrieval-augmented analysis** — Embed each session turn, store vectors in a pgvector column; at update time retrieve the most semantically similar prior turns and include them in the prompt. — Pros: Scales gracefully to hundreds of sessions; retrieves only the most relevant context. Cons: Requires pgvector extension (requires explicit Supabase enablement and schema addition); adds an embedding pipeline, vector storage, and retrieval logic — significant complexity for a beta feature with few sessions per user; the session volume at beta scale does not justify this infrastructure.

#### Decision

**Option 2 (incremental merge)**. At beta scale, token costs are small and analysis quality is acceptable. The 200-word prior state + ~300 tokens of new session content fits comfortably within any modern LLM context window. If analysis quality degrades at higher session counts, a full-rebuild correction can be run as a background utility in a future iteration — the schema supports this without changes.

**Update trigger**: `journal-save-session` marks the session `completed`, then fires `updateUserState(userId, sessionId)` as fire-and-forget (`.catch(() => {})`). The save HTTP response is returned before the state update completes. If the update fails, it is logged via ADR-003 (`phase: "journal_state_update"`, `event: "ai.error"`) — the session save itself is unaffected and the session is correctly marked `completed`.

**First session handling**: if no `user_state` row exists for the user, the function passes only the new session Q&A and prompts the AI to produce an initial 200-word analysis (no prior state to merge).

**Model resolution chain (state update)**: `OPENROUTER_JOURNAL_MODEL` → `OPENROUTER_TOPIC_MODEL` → `google/gemini-2.5-flash-lite`.

---

### Decision 3 of 4 — Opening Question

#### Context

Every journal session starts with the same fixed question. It must be open-ended, non-presumptuous, invite reflection on the day (internal and external), and embody the Sanctuary brand: calm, intentional, serene. It is stored as a versioned constant `JOURNAL_OPENING_QUESTION_V1` in the mobile client and referenced in the `journal-next-question` system prompt so the AI can see what question the user answered when generating follow-ups. The opening question is never generated by the AI.

#### Options Considered

1. **"How has your day been — what's stayed with you as the hours have passed?"** — Simple, warm, conversational. Invites both positive and negative reflection. Slightly passive ("stayed with you") and implies end-of-day timing. Does not explicitly offer multiple entry points for users who feel stuck.

2. **"Take a moment to settle in. What's on your mind today — something that happened, a feeling, or just a thought that's been with you?"** — Brand-aligned opening clause ("Take a moment to settle in" = calm, intentional); explicitly offers three entry points (event, feeling, thought) covering both external and internal dimensions; non-presumptuous; works at any time of day; the parenthetical options reduce blank-page anxiety without prescribing content.

3. **"What's been present for you today? There's no right answer — just what comes to mind."** — Very open; explicitly reduces performance pressure. However, "no right answer" may paradoxically heighten awareness of judgment. Less directionally inviting than option 2; "present for you" is slightly abstract.

#### Decision

**Option 2**: `JOURNAL_OPENING_QUESTION_V1 = "Take a moment to settle in. What's on your mind today — something that happened, a feeling, or just a thought that's been with you?"`

This question best embodies the Sanctuary brand. The opening clause ("Take a moment to settle in") is an invitation to slow down — directly consistent with the "calm, intentional, serene" brand positioning. The main clause offers three explicit entry points (event, feeling, thought) that cover both the external events and internal reflections the session should explore, without presupposing which the user will lead with. It is non-presumptuous, works at any time of day, and makes no assumptions about the user's life situation.

The constant is versioned (`_V1`) so future revisions can be tracked alongside existing sessions. `journal_sessions.opening_question_version` records which version was in use for each session.

---

### Decision 4 of 4 — Resume/Start-Fresh Handling

#### Context

A user may open the Journal tab, begin answering questions, and leave the app before tapping "Save Journal" (phone call, notification, battery death). On the next app open, the product spec requires the app to detect this and offer: "Continue your earlier session or start fresh?" Incomplete sessions must survive app termination. The design question is when and how journal data is written to the database during an active session.

#### Options Considered

1. **Incremental persistence — write each answer to DB immediately** — When the session opens, insert a `journal_sessions` row (`status: 'pending'`). When each question is displayed, insert the corresponding `journal_entries` row (question text, NULL answer). When the user submits an answer, update the entry row with the answer and `answered_at`. On final save: `journal-save-session` marks the session `completed`. On resume: query the pending session, load entries, resume from the first unanswered turn. — Pros: App crash does not lose any submitted answer; seamless resume from any point; DB is the authoritative state; simple recovery logic. Cons: Up to ~6 DB writes per session (vs 1 for final-save-only); network failures mid-session could create partial state (harmless but requires server to handle gracefully).

2. **Client-side only — hold Q&A in React state, persist only on final save** — Q&A pairs accumulate in component state. On save, the client posts the full session payload (all turns at once) to `journal-save-session`. — Pros: Minimal DB writes; single transactional POST. Cons: If the app is killed, the in-progress session is lost entirely — genuine resume is impossible. **This option violates the product specification and is unacceptable.**

3. **Session row on start, Q&A in client state until save** — Insert the `journal_sessions` row immediately (marking a session in progress); Q&A accumulates in client state; all entries written on save. Resume is detectable (pending session row exists) but Q&A is not recoverable — the "resume" prompt would effectively only offer start-fresh. — Pros: Fewer DB writes than Option 1; in-progress session is detectable. Cons: Cannot actually resume the conversation — the resume prompt is misleading. Contradicts the product specification.

#### Decision

**Option 1 (incremental persistence)**. This is the only approach that enables genuine, user-transparent resume. The cost — a few extra DB writes per session — is negligible at beta scale. Partial state created by mid-session failures is safe (rows are user-scoped via RLS; the session is recoverable on next open or it expires after 24 hours).

**Session state machine**:

```
[pending]  — session created; opening question shown; answering in progress
    |
    +--- user taps "Save Journal"  -----> [completed]
    |                                     (completed_at set; user_state update queued)
    +--- user taps "Start fresh"   -----> [abandoned]
         (new pending session created; old session marked abandoned)
```

There is no separate `active` state. A session is `pending` from creation until it becomes `completed` or `abandoned`. `completed_at` is NULL for pending and abandoned rows; it is set when `journal-save-session` succeeds.

**Resume detection**: on Journal tab open, query `journal_sessions WHERE user_id = auth.uid() AND status = 'pending' AND created_at > now() - interval '24 hours'`. A 24-hour window prevents very old interrupted sessions from resurfacing. Sessions outside the window are not offered for resume (they remain in `pending` status in the DB; no automatic transition — a future cleanup job could abandon them).

**Start-fresh flow**: update the found pending session to `status = 'abandoned'`, then create a new `journal_sessions` row (`status = 'pending'`).

---

### Consequences

- **Positive**: The journal feature reuses the existing OpenRouter edge-function infrastructure, ADR-003 observability, and the ADR-004/ADR-005 `expo-notifications` local notification pattern — no new external dependencies. The 200-word user state keeps AI token costs bounded per call regardless of how many prior sessions exist. Incremental persistence enables genuine resume UX. The fixed opening question is versioned, enabling future A/B testing without invalidating existing sessions. The evening reminder follows identical code patterns to the ADR-005 morning reminder, minimising implementation novelty.
- **Negative**: Incremental persistence creates up to ~6 DB writes per session (vs 1 for a final-save-only approach). The incremental user state merge may drift over many sessions; a full-rebuild correction utility is not planned for v1. Evening notification content is generic (not AI-personalised in the push body — same trade-off as the ADR-005 morning notification). The `user_state` analysis must not be shown mid-session to the user to avoid biasing their responses.
- **Neutral**: Three new tables (`journal_sessions`, `journal_entries`, `user_state`) and two new edge functions (`journal-next-question`, `journal-save-session`) are added. The `user_preferences` table gains two new keys: `evening_notification_id` (text) and `evening_notification_time` (string `"HH:MM"`, default `"21:00"`). Navigation gains a new Journal tab (4th tab in bottom nav). Journal history is a separate screen from the Thoughts inbox.

---

## ADR-007: Revert the AI-Guided Journal Feature

**Date**: 2026-07-13
**Status**: Accepted
**Deciders**: Josip

### Context

The AI-guided journal subsystem (ADR-006) shipped in April 2026: journal tab and session screens, `journal-next-question` and `journal-save-session` edge functions, migration `007_journal.sql` (`journal_sessions`, `journal_entries`, `user_state`), the evening reminder, `user_state` seeding from OCEAN onboarding, and `user_state` context in morning-message generation. The product owner has directed that the journaling feature be removed.

### Decision

Revert the journal feature from the codebase while preserving database history and user data:

1. **Client**: remove the Journal tab, all `src/app/(app)/journal/` screens, the Settings "Journal" section (evening reminder toggle/time, journal profile row), and the evening reminder helpers in `src/lib/notifications.ts`.
2. **Edge functions**: delete `journal-next-question` and `journal-save-session` (code and `config.toml` entries). Remove the fire-and-forget `user_state` seeding from `score-ocean-profile` and the `user_state` context from `generate-morning-message` (the recent daily check-in context is retained — check-ins are not part of the journal feature).
3. **Database**: migration `007_journal.sql` is **kept** in `supabase/migrations/` — it is already applied to the hosted project, and deleting an applied migration file breaks `supabase db push` history. The three journal tables remain in the database as **inert** (RLS-protected, no code paths touch them). Dropping or archiving them — and deciding what happens to existing journal data — is deferred to a future reviewed migration per `.claude/rules/migrations.md` (no `DROP TABLE` without an archive step and explicit approval).
4. **Docs**: journal sections removed from ARCHITECTURE.md, API.md, DATABASE.md, and USER_GUIDE.md; journal tasks #043–#049 removed from TODO.md and `.tasks/`.

### Consequences

- **Positive**: The app returns to its pre-journal surface (Capture, Thoughts, Library) with no user-facing journal entry points; OCEAN onboarding and morning messages continue to work, now driven by the profile and recent check-in only.
- **Negative**: The deployed `journal-next-question` / `journal-save-session` functions must be deleted from the Supabase project separately (`supabase functions delete`), since the deploy workflow only deploys functions present in the repo — it does not remove ones that have been deleted. Until then they remain callable (auth-gated, harmless).
- **Neutral**: Inert journal tables and any existing journal rows remain in the database (tracked in DATABASE.md Known Issues). `user_preferences` rows with `evening_notification_*` keys may remain for users who enabled the reminder; devices that already scheduled the evening notification will keep receiving it until the OS notification is cancelled or the app is reinstalled — acceptable for the friends-and-family beta. Re-introducing journaling later requires a new ADR.

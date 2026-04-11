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

**Option 1 (AI-analysed free-text)**. The reflective free-text approach is consistent with how Sanctuary already captures voice and text thoughts. At beta scale the per-user AI cost is negligible, the one-time latency is acceptable behind a loading screen, and the approximate nature of AI-derived scores is appropriate for a personalisation use case (not clinical assessment). Model resolution follows the existing pattern: `OPENROUTER_OCEAN_MODEL` env var → `OPENROUTER_TOPIC_MODEL` → `google/gemini-2.0-flash-001` as default.

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

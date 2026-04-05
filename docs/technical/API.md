<!--
DOCUMENT METADATA
Owner: @backend-developer
Update trigger: Any API endpoint is added, modified, or removed
Update scope: Full document
Read by: All agents building or integrating with backend functionality.
-->

# API Reference

> **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
> **Client**: `@supabase/supabase-js` — used directly in the mobile app and in edge functions
> **Authentication**: Supabase JWT (managed by Supabase Auth). Pass the session token via the Supabase client — it is sent automatically as a Bearer token.
> **Last updated**: 2026-03-31 (detect-list planned endpoint documented; lists subsystem tasks #029–#036)

---

## Overview

Sanctuary does not have a traditional REST API server. The mobile app interacts with Supabase directly using the Supabase JS client for:
- **Auth**: Sign up, sign in, sign out, password reset
- **Database**: Direct table queries (filtered by RLS — users only see their own rows)
- **Edge Functions**: AI-powered endpoints — `transcribe` (multipart audio → transcript + topic assignment + reminder detection), `assign-topics` (typed capture path, also triggers reminder detection), and `detect-reminders` (explicit reminder extraction endpoint). All call OpenRouter server-side. **Voice audio is not stored in Supabase Storage** in v1; it is posted to `transcribe` and discarded after processing. **Observability**: AI-related steps emit structured lines to Edge Function logs — see [Observability (AI edge functions)](#observability-ai-edge-functions) below; policy and full contract: [ADR-003](DECISIONS.md#adr-003-ai-io-observability-via-supabase-edge-function-logs) and `docs/technical/ARCHITECTURE.md` (Observability and AI I/O logging).
- **Storage**: Available from Supabase for future features; not used for voice capture in v1.

This document tracks the Edge Function endpoints. Standard Supabase client patterns are documented in the Supabase docs.

---

## Authentication

Auth is handled entirely by Supabase Auth using `supabase.auth.*` methods. See [Supabase Auth docs](https://supabase.com/docs/reference/javascript/auth-signup) for the client API.

Sessions are automatically injected into all database queries by the Supabase client.

---

## Edge Functions

> Base URL: `https://<project-ref>.supabase.co/functions/v1/`
> Auth: All edge functions require a valid Supabase session token (passed automatically by the Supabase client)

---

### POST /transcribe

**Description**: Transcribe a voice recording to text using an OpenRouter-routed model.

**Auth required**: Yes (Supabase session token)

**Request**: `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `audio` | file | The raw audio file recorded on device (m4a/webm) |
| `thought_id` | string | UUID of the thought row to update with transcript |
| `iana_timezone` | string | Optional — IANA id from the device (`Intl…timeZone`), e.g. `Europe/Zagreb`. Passed through to reminder extraction. |
| `current_local_iso` | string | Optional — device **local** “now” as ISO 8601 with offset (e.g. `2026-03-30T14:35:00+02:00`). When set, used instead of server UTC for reminder extraction context. |

**Response 200**:
```json
{
  "transcript": "string — transcribed text",
  "thought_id": "string — UUID of the updated thought",
  "topics": ["string — primary topic name when assignment succeeds"]
}
```

The `topics` field is present when topic assignment completes successfully inside the same request; if assignment fails, `transcription_status` is still `complete` but `tagging_status` is `failed` and `topics` may be omitted.

**Error codes**: `400` (missing params), `401` (unauthenticated), `500` (OpenRouter error)

**Notes**: Audio is sent directly as a file upload — it is NOT stored in Supabase Storage. The transcript is written to `thoughts.body` and `transcription_status` is set to `'complete'`. The function then runs **topic assignment** (shared module with `/assign-topics`): OpenRouter returns structured JSON; the server reuses an existing `user_topics` row when `best_match_score` > 0.2, otherwise creates a new topic. Updates `thought_topics`, denormalized `thoughts.topics`, and `tagging_status`.

**Browser / CORS**: The Edge Function must answer `OPTIONS` preflight and attach CORS headers on all responses. Use `corsHeaders` from `@supabase/supabase-js/cors` (see [Supabase CORS guide](https://supabase.com/docs/guides/functions/cors)) so Expo Web and other browser clients can call `/transcribe` cross-origin. On web, append a real `File`/`Blob` to `FormData` (not the React Native `{ uri, name, type }` object), or the part body becomes the string `[object Object]` and the function returns 400.

**JWT at gateway**: Set `[functions.transcribe] verify_jwt = false` in `supabase/config.toml` and redeploy. Otherwise the platform rejects `OPTIONS` (no `Authorization` on preflight) with a non-2xx and the browser reports a CORS failure. `POST` remains protected by checking the Bearer token inside the function (`getUser()`).

---

### POST /assign-topics

**Description**: Assign **one primary topic** to a thought from typed capture using an OpenRouter-routed model. Uses the same logic as the post-transcription step inside `/transcribe` (`supabase/functions/_shared/assign-topics.ts`).

**Auth required**: Yes (Supabase session token)

**Request body**:
```json
{
  "thought_id": "string — UUID of the thought",
  "text": "string — the full thought text to analyze",
  "iana_timezone": "string — optional IANA timezone from the device",
  "current_local_iso": "string — optional local now with offset (ISO 8601) for reminder extraction"
}
```

**Response 200**:
```json
{
  "thought_id": "string",
  "topics": ["string — single topic display name"]
}
```

**Error codes**: `400` (missing params or empty strings), `401` (unauthenticated), `404` (thought not found or not owned by caller), `502` (OpenRouter error, unparseable response, or assignment failure), `500` (server configuration or DB write failure)

**Notes**: Loads the caller’s `user_topics`, prompts the model for structured JSON (`best_existing_normalized_name`, `best_match_score` 0–1, `new_topic`). Reuses an existing topic when `best_match_score` > **0.2** and the name matches the catalog; otherwise inserts into `user_topics` and links via `thought_topics`. Syncs `thoughts.topics` (one-element array) and `tagging_status`. Model: `OPENROUTER_TOPIC_MODEL` if set, else `OPENROUTER_TAGGING_MODEL`, default `google/gemini-2.0-flash-001`. Fire-and-forget reminder detection uses `iana_timezone` and `current_local_iso` when provided (same semantics as `/transcribe` multipart fields).

**JWT at gateway**: `[functions.assign-topics] verify_jwt = false` in `supabase/config.toml` for `OPTIONS` preflight; `POST` validates the Bearer token via `getUser()`.

---

### POST /reflection-prompt

**Description**: Generate an AI reflection prompt for a given thought.

**Auth required**: Yes (Supabase session token)

**Request body**:
```json
{
  "thought_id": "string — UUID of the thought",
  "text": "string — the thought text to generate a prompt for"
}
```

**Response 200**:
```json
{
  "thought_id": "string",
  "prompt": "string — a single reflection question or prompt"
}
```

**Notes**: Does not persist to the database — returns the prompt for inline display. To be implemented as part of task #010 (thought detail screen).

---

### POST /detect-reminders

**Auth required**: Yes (Supabase session token)

**Description**: Extract future time references from a thought's text using an OpenRouter-routed model and persist them as `inactive` reminder rows in the `reminders` table. Returns the count of reminders inserted. The mobile app calls this endpoint after thought capture; the pipeline also fires it automatically (fire-and-forget) after `assign-topics` completes inside both the `transcribe` and `assign-topics` edge functions.

**Request body**:
```json
{
  "thought_id": "string — UUID of the thought",
  "text": "string — the full thought text to scan for time references",
  "current_iso_timestamp": "string — ISO 8601 datetime (optional; falls back to server clock). Prefer device **local** time with explicit offset.",
  "iana_timezone": "string — optional IANA id (e.g. Europe/Zagreb); strengthens local interpretation for the model"
}
```

**Response 200**:
```json
{
  "thought_id": "string",
  "reminder_count": "number — count of inactive reminder rows inserted (0 when no future time references found)"
}
```

**Error codes**:
- `400` — Missing or invalid `thought_id` / `text`
- `401` — Unauthenticated
- `404` — Thought not found or not owned by caller
- `500` — Server configuration error (missing env vars)

**Notes**: Sets `thoughts.reminder_detection_status` to `'pending'` → `'complete'` (or `'failed'` on error). Inserted reminders have `status = 'inactive'`; the mobile app is responsible for surfacing them for user approval and scheduling local notifications (the edge function does **not** schedule push notifications). The model populates `reminders.extracted_text` with a **short display title** (not a verbatim snippet of the thought). Uses `OPENROUTER_REMINDER_MODEL` if set, then `OPENROUTER_TOPIC_MODEL`, then `google/gemini-2.0-flash-001`. The extraction prompt uses `current_iso_timestamp` and optional `iana_timezone` so relative phrases resolve in the user’s locale (the mobile app sends both on typed and voice capture). When `iana_timezone` is present, if the model returns `scheduled_at` with `Z` or `±00:00` but the digits represent the user’s intended **local** wall time (a common model mistake), the server reinterprets that timestamp in the IANA zone before insert so storage matches local intent. Structured AI logs are emitted via `console.debug` (phase: `reminders`) per ADR-003.

**JWT at gateway**: `[functions.detect-reminders] verify_jwt = false` in `supabase/config.toml` for `OPTIONS` preflight; `POST` validates the Bearer token via `getUser()`.

---

### POST /detect-list ⚠️ PLANNED

**Auth required**: Yes (Supabase session token)

**Description**: Detect whether a captured thought is primarily a list (shopping, tasks, ideas, etc.), extract its title and items, and detect whether it is a continuation of an existing list. Creates `user_lists` + `list_items` rows on detection, or appends items to an existing list on continuation. Invoked fire-and-forget from `transcribe` and `assign-topics` after topic assignment — same pattern as `detect-reminders`.

**Request body**:
```json
{
  "thought_id": "string — UUID of the thought",
  "text": "string — the full thought text to scan"
}
```

**Response 200**:
```json
{
  "thought_id": "string",
  "is_list": "boolean",
  "list_id": "string | null — UUID of the created or updated user_lists row",
  "is_continuation": "boolean — true when items were appended to an existing list",
  "item_count": "number — items inserted or appended (0 when not a list)"
}
```

**Error codes**:
- `400` — Missing or invalid `thought_id` / `text`
- `401` — Unauthenticated
- `404` — Thought not found or not owned by caller
- `500` — Server configuration error

**Notes**: The shared module `_shared/detect-list.ts` loads the caller's existing `user_lists` titles and passes them to the model so continuation can be detected. When `is_continuation` is true, new items are appended to the matching existing list rather than creating a duplicate. Sets `thoughts.list_detection_status` to `'pending'` → `'complete'` (or `'failed'` on error). Uses `OPENROUTER_LIST_MODEL` if set, then `OPENROUTER_TOPIC_MODEL`, then `google/gemini-2.0-flash-001`. AI logs follow the ADR-003 contract with `phase: "lists"`.

**JWT at gateway**: `[functions.detect-list] verify_jwt = false` in `supabase/config.toml` for `OPTIONS` preflight; `POST` validates the Bearer token via `getUser()`.

---

## Direct table access patterns (Reminders)

The mobile app interacts with the `reminders` table directly via the Supabase JS client (RLS enforces `user_id = auth.uid()` on all operations — no edge function wrapper needed).

### Fetch pending (inactive) reminders

```typescript
const { data, error } = await supabase
  .from('reminders')
  .select('id, thought_id, extracted_text, scheduled_at, status, created_at')
  .eq('status', 'inactive')
  .order('scheduled_at', { ascending: true });
```

Returns all reminders awaiting user approval, ordered by scheduled time.

### Approve a reminder

Sets `status` to `'active'` and records the Expo notification ID (populated by the mobile client after scheduling the local notification). Optionally accepts a user-edited `scheduled_at`.

```typescript
const { error } = await supabase
  .from('reminders')
  .update({
    status: 'active',
    notification_id: expoNotificationId,   // string from Expo Notifications API
    scheduled_at: userEditedTime ?? originalScheduledAt,
    updated_at: new Date().toISOString(),
  })
  .eq('id', reminderId);
```

### Dismiss a reminder

```typescript
const { error } = await supabase
  .from('reminders')
  .update({ status: 'dismissed', updated_at: new Date().toISOString() })
  .eq('id', reminderId);
```

### Mark a reminder as sent (client-side, after notification fires)

```typescript
const { error } = await supabase
  .from('reminders')
  .update({ status: 'sent', updated_at: new Date().toISOString() })
  .eq('id', reminderId);
```

**Security note**: All four patterns rely on RLS (`user_id = auth.uid()`). The mobile client must be authenticated; the anon key alone does not grant cross-user access.

---

## Observability (AI edge functions)

For operators debugging `transcribe` and `assign-topics` (shared topic pipeline): structured AI events are written as **single-line JSON** via **`console.debug`** (DEBUG level in the dashboard) and include `"log_level":"debug"` in the payload. Filter logs by **DEBUG** to see OpenRouter request/response detail; `console.error` elsewhere in edge code remains for non-AI infrastructure failures.

**Where to look**

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) for your project.
2. Go to **Edge Functions**.
3. Open the function (`transcribe`, `assign-topics`, or `detect-reminders`) and use **Logs** (or the project **Logs** view filtered to that function, depending on dashboard layout).

There is **no** separate HTTP API or Postgres table for these events in v1. Retention and search are **platform-managed** — do not rely on logs as a long-term audit archive; see ADR-003.

**Hosted Supabase limit:** each custom console line (including **`console.debug`**) is capped at **10,000 characters** ([Functions logging](https://supabase.com/docs/guides/functions/logging)). The `ai-log` helper clamps each emitted JSON line to stay under that cap (large `openrouter_*` objects are replaced with `_truncated` previews if needed). If you see no AI lines, enable **DEBUG** in the log level filter, confirm the function was invoked on this project, and check the **Logs** tab (not only **Invocations**).

**Reading `event_message`:** the dashboard often shows your payload as a **JSON-encoded string** inside `event_message`. Parse **twice** (or `JSON.parse(JSON.parse(row.event_message))` if the outer row is already an object) to get a single object. That object includes **`log_summary`** (a short human-readable line) and **`openrouter_request` / `openrouter_response` as nested objects** — not escaped JSON strings — so prompts and model output are readable after parsing.

**Example log line shape**

Each event is one **single-line JSON** object emitted with **`console.debug`**. Pretty-printed examples below are for reading only; in the dashboard you will see one line per event (level **DEBUG**).

Successful transcription step start:

```json
{
  "log_summary": "[sanctuary-ai] ai.request.start | fn=transcribe | phase=transcribe | thought=… | model=…",
  "log_level": "debug",
  "event": "ai.request.start",
  "function": "transcribe",
  "phase": "transcribe",
  "model": "google/gemini-2.0-flash-001",
  "thought_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440001",
  "request_summary": {
    "audio_mime": "audio/mp4",
    "audio_bytes": 48210,
    "audio_format": "m4a",
    "transcription_language": "auto",
    "prompt_preview": "Transcribe the following audio…"
  }
}
```

Topic phase failure (same transport: **`console.debug`**; distinguish failures via `event` and `error`):

```json
{
  "log_summary": "[sanctuary-ai] ai.error | fn=assign-topics | phase=topics | thought=… | model=…",
  "log_level": "debug",
  "event": "ai.error",
  "function": "assign-topics",
  "phase": "topics",
  "model": "google/gemini-2.0-flash-001",
  "thought_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440001",
  "error": {
    "message": "Topic JSON parse failed",
    "kind": "topic_json_parse"
  },
  "response_summary": {
    "raw_preview": "{\"broken\": …",
    "raw_chars": 42
  }
}
```

Optional fields (`model`, `thought_id`, `user_id`, summaries, `error`) are omitted when not set — see `supabase/functions/_shared/ai-log.ts`.

**`event` values**

| `event` | Meaning |
|---------|---------|
| `ai.request.start` | An OpenRouter-bound step is starting (transcription or topic assignment). |
| `ai.response.complete` | That step finished successfully from the model’s perspective (HTTP OK and a usable body). |
| `ai.error` | Failure: OpenRouter HTTP error, empty transcript, unparseable topic JSON, etc. Still emitted at **DEBUG** via `console.debug` (payload includes `error`). |

**Common fields** (optional fields are omitted when not applicable)

| Field | Meaning |
|-------|---------|
| `log_level` | Always `"debug"` for lines emitted by `ai-log.ts`. |
| `log_summary` | Short human-readable line (same info as the headline) for skimming raw `event_message`. |
| `function` | `transcribe` or `assign-topics` (or the caller name passed into shared topic code). |
| `phase` | `transcribe` — speech-to-text OpenRouter call inside `/transcribe` only. `topics` — topic-assignment OpenRouter call: runs **after** a successful transcribe in the same `/transcribe` request, or alone inside `/assign-topics` for typed capture. A single voice capture therefore produces **both** phases in order in the logs when both steps run. |
| `model` | OpenRouter model id used for that call. |
| `thought_id` | Thought UUID when known. |
| `user_id` | Authenticated user UUID for correlation. |
| `request_summary` | Non-secret metadata only — e.g. for voice: MIME type, byte length, format, truncated prompt preview (not raw audio). For topics: catalog size, thought text length, **truncated** thought preview, prompt length. |
| `response_summary` | Aggregates or **truncated** previews — e.g. transcript character count and preview, latency ms, OpenRouter error body preview, topic JSON preview on parse errors. |
| `openrouter_request` | Nested object: OpenRouter request **body** (`model` + `messages`). Voice: `input_audio.data` is **not** logged; replaced with a length placeholder. Subject to **≤10k** line cap (may become `_truncated` preview). |
| `openrouter_response` | Nested object: OpenRouter **response** JSON, or `{ http_status, body }` / `{ assistant_message_text }` on errors — same line cap. |
| `error` | `{ message, http_status?, kind? }` — human-readable message, optional HTTP status from OpenRouter, optional machine-readable `kind` (e.g. `openrouter_http`, `empty_transcript`, `topic_json_parse`). |

**PRD (Security NFR) — device vs server**

The PRD Security NFR requires **no user data in device logs or in analytics SDK payloads** (the mobile app must not log thought bodies, transcripts, tokens, or similar client-side). That rule does **not** forbid **server-side** Edge Function logs used to operate the AI pipeline. Those server logs are allowed when they follow the redaction rules here and in `docs/technical/ARCHITECTURE.md` (*Observability and AI I/O logging*). Full rationale: [ADR-003](DECISIONS.md#adr-003-ai-io-observability-via-supabase-edge-function-logs).

**Privacy (operator expectations)**

- **No raw audio** in logs: no buffers, base64-encoded audio, file bytes, or multipart bodies — only metadata such as MIME type and byte length (as in `request_summary` for the transcribe phase). The `openrouter_request` object for transcription still includes the **text** prompt and a **placeholder** where base64 would have been.
- **No secrets**: API keys and service role material must never appear in log lines (the key is only in HTTP headers, not in logged JSON bodies).
- **`request_summary` / `response_summary`** use short previews for quick reading. **Full** request/response payloads for OpenRouter (within size limits) live in **`openrouter_request`** / **`openrouter_response`** as nested objects. Tune **`OPENROUTER_LOG_JSON_MAX_CHARS`** (Edge secret) if large topic catalogs truncate the topic prompt JSON. Full contract: `docs/technical/ARCHITECTURE.md` — *Observability and AI I/O logging*.

**Decision record**: [ADR-003 — AI I/O observability via Supabase Edge Function logs](DECISIONS.md#adr-003-ai-io-observability-via-supabase-edge-function-logs).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-28 | Initial stub — edge function signatures defined |
| 2026-03-28 | Implemented tag-thought edge function (task #008) |
| 2026-03-28 | Replaced tag-thought with assign-topics; user_topics + thought_topics; transcribe runs topic assignment; thoughts.tags renamed to topics |
| 2026-03-30 | Overview: voice path uses multipart to `transcribe` only — no Storage for recordings in v1 |
| 2026-03-30 | Observability: AI edge logging for operators (`event` types, fields, privacy); link ADR-003 |
| 2026-03-30 | Observability: example log JSON, PRD Security NFR vs server-side logs, clarify `phase` ordering for `/transcribe` |
| 2026-03-30 | Observability: nested `openrouter_request` / `openrouter_response`, `OPENROUTER_LOG_JSON_MAX_CHARS`, sanitized audio; **DEBUG** via `console.debug` |
| 2026-03-30 | Added `POST /detect-reminders` edge function; pipeline wiring in `transcribe` and `assign-topics` (fire-and-forget); reminders direct table access patterns (task #025) |
| 2026-03-30 | Observability: include `detect-reminders` in dashboard log navigation list |
| 2026-03-31 | Reminder extraction: optional `iana_timezone` + local `current_local_iso` / `current_iso_timestamp` for device-accurate timezones (`transcribe`, `assign-topics`, `detect-reminders`) |
| 2026-03-31 | Reminder `scheduled_at`: normalize UTC-stamped local wall times using `iana_timezone` before insert (`_shared/reminder-scheduled-at-normalize.ts`) |
| 2026-03-31 | Added planned `POST /detect-list` endpoint spec; lists subsystem tasks #029–#036 |
| 2026-04-05 | Reminder extraction: `extracted_text` is prompted as a concise title (`_shared/detect-reminders.ts`) |
| 2026-04-05 | CI: `.github/workflows/deploy-supabase.yml` pushes migrations and deploys edge functions on `main` when `supabase/**` changes |

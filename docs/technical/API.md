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
> **Last updated**: 2026-03-30 (AI observability ops notes)

---

## Overview

Sanctuary does not have a traditional REST API server. The mobile app interacts with Supabase directly using the Supabase JS client for:
- **Auth**: Sign up, sign in, sign out, password reset
- **Database**: Direct table queries (filtered by RLS — users only see their own rows)
- **Edge Functions**: AI-powered endpoints — `transcribe` (multipart audio → transcript + topic assignment) and `assign-topics` (typed capture path). Both call OpenRouter server-side. **Voice audio is not stored in Supabase Storage** in v1; it is posted to `transcribe` and discarded after processing. **Observability**: AI-related steps emit structured lines to Edge Function logs — see [Observability (AI edge functions)](#observability-ai-edge-functions) below; policy and full contract: [ADR-003](DECISIONS.md#adr-003-ai-io-observability-via-supabase-edge-function-logs) and `docs/technical/ARCHITECTURE.md` (Observability and AI I/O logging).
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
  "text": "string — the full thought text to analyze"
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

**Notes**: Loads the caller’s `user_topics`, prompts the model for structured JSON (`best_existing_normalized_name`, `best_match_score` 0–1, `new_topic`). Reuses an existing topic when `best_match_score` > **0.2** and the name matches the catalog; otherwise inserts into `user_topics` and links via `thought_topics`. Syncs `thoughts.topics` (one-element array) and `tagging_status`. Model: `OPENROUTER_TOPIC_MODEL` if set, else `OPENROUTER_TAGGING_MODEL`, default `google/gemini-2.0-flash-001`.

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

## Observability (AI edge functions)

For operators debugging `transcribe` and `assign-topics` (shared topic pipeline): structured AI events are written as **single-line JSON** via Deno `console` and appear in the Supabase project.

**Where to look**

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) for your project.
2. Go to **Edge Functions**.
3. Open the function (`transcribe` or `assign-topics`) and use **Logs** (or the project **Logs** view filtered to that function, depending on dashboard layout).

There is **no** separate HTTP API or Postgres table for these events in v1. Retention and search are **platform-managed** — do not rely on logs as a long-term audit archive; see ADR-003.

**`event` values**

| `event` | Meaning |
|---------|---------|
| `ai.request.start` | An OpenRouter-bound step is starting (transcription or topic assignment). |
| `ai.response.complete` | That step finished successfully from the model’s perspective (HTTP OK and a usable body). |
| `ai.error` | Failure: OpenRouter HTTP error, empty transcript, unparseable topic JSON, etc. Emitted on `console.error` with the same JSON shape. |

**Common fields** (optional fields are omitted when not applicable)

| Field | Meaning |
|-------|---------|
| `function` | `transcribe` or `assign-topics` (or the caller name passed into shared topic code). |
| `phase` | `transcribe` — audio → text; `topics` — topic assignment (runs inside `transcribe` after transcribe, or inside `assign-topics` for typed capture). |
| `model` | OpenRouter model id used for that call. |
| `thought_id` | Thought UUID when known. |
| `user_id` | Authenticated user UUID for correlation. |
| `request_summary` | Non-secret metadata only — e.g. for voice: MIME type, byte length, format, truncated prompt preview (not raw audio). For topics: catalog size, thought text length, **truncated** thought preview, prompt length. |
| `response_summary` | Aggregates or **truncated** previews — e.g. transcript character count and preview, latency ms, OpenRouter error body preview, topic JSON preview on parse errors. |
| `error` | `{ message, http_status?, kind? }` — human-readable message, optional HTTP status from OpenRouter, optional machine-readable `kind` (e.g. `openrouter_http`, `empty_transcript`, `topic_json_parse`). |

**Privacy (operator expectations)**

- **No raw audio** in logs: no buffers, base64 payloads, or multipart bodies.
- **No secrets**: API keys and service role material must never appear in log lines.
- Text fields in summaries use **truncation** (short previews plus lengths where relevant), not full prompts or full user transcripts in routine lines. Full operational contract and prohibited fields: `docs/technical/ARCHITECTURE.md` — *Observability and AI I/O logging*.

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

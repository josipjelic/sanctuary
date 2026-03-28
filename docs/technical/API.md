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
> **Last updated**: 2026-03-28

---

## Overview

Sanctuary does not have a traditional REST API server. The mobile app interacts with Supabase directly using the Supabase JS client for:
- **Auth**: Sign up, sign in, sign out, password reset
- **Database**: Direct table queries (filtered by RLS — users only see their own rows)
- **Storage**: Upload/download voice recordings
- **Edge Functions**: AI-powered endpoints (transcription, tagging) that call OpenRouter server-side

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
  "thought_id": "string — UUID of the updated thought"
}
```

**Error codes**: `400` (missing params), `401` (unauthenticated), `500` (OpenRouter error)

**Notes**: Audio is sent directly as a file upload — it is NOT stored in Supabase Storage. Only the transcript text is persisted (to `thoughts.body`). Sets `transcription_status: 'complete'` on success. To be implemented in task #007.

**Browser / CORS**: The Edge Function must answer `OPTIONS` preflight and attach CORS headers on all responses. Use `corsHeaders` from `@supabase/supabase-js/cors` (see [Supabase CORS guide](https://supabase.com/docs/guides/functions/cors)) so Expo Web and other browser clients can call `/transcribe` cross-origin. On web, append a real `File`/`Blob` to `FormData` (not the React Native `{ uri, name, type }` object), or the part body becomes the string `[object Object]` and the function returns 400.

**JWT at gateway**: Set `[functions.transcribe] verify_jwt = false` in `supabase/config.toml` and redeploy. Otherwise the platform rejects `OPTIONS` (no `Authorization` on preflight) with a non-2xx and the browser reports a CORS failure. `POST` remains protected by checking the Bearer token inside the function (`getUser()`).

---

### POST /tag-thought

**Description**: Auto-tag a thought using an OpenRouter-routed language model.

**Auth required**: Yes (Supabase session token)

**Request body**:
```json
{
  "thought_id": "string — UUID of the thought to tag",
  "text": "string — the full thought text to analyze"
}
```

**Response 200**:
```json
{
  "thought_id": "string",
  "tags": ["string", "..."]
}
```

**Error codes**: `400` (missing params or empty strings), `401` (unauthenticated), `404` (thought not found or not owned by caller), `502` (OpenRouter error or unparseable response), `500` (server configuration error or DB write failure)

**Notes**: Updates the `thoughts.tags` column and sets `tagging_status: 'complete'` on success, `'failed'` on any OpenRouter or parse error. Tags are normalized: lowercase, whitespace-trimmed, deduplicated, capped at 4. Model is configurable via the `OPENROUTER_TAGGING_MODEL` Supabase secret (default: `google/gemini-2.0-flash-001`). Implemented in task #008.

**JWT at gateway**: Set `[functions.tag-thought] verify_jwt = false` in `supabase/config.toml` so `OPTIONS` preflight requests (which carry no `Authorization` header) are not rejected at the gateway. `POST` remains protected by validating the Bearer token inside the function via `getUser()`.

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

## Changelog

| Date | Change |
|------|--------|
| 2026-03-28 | Initial stub — edge function signatures defined |
| 2026-03-28 | Implemented tag-thought edge function (task #008) |

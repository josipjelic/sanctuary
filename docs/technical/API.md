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

**Error codes**: `400` (missing params), `401` (unauthenticated), `500` (OpenRouter error)

**Notes**: Updates the `thoughts.tags` column and sets `tagging_status: 'complete'`. Tags are lowercase, single words or short phrases (e.g., `"idea"`, `"grocery"`, `"feeling"`, `"task"`). To be implemented in task #008.

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

---
id: "007"
title: "Integrate OpenRouter for voice transcription"
status: "todo"
area: "backend"
agent: "@backend-developer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-011", "FR-012", "FR-016"]
blocks: ["008", "014"]
blocked_by: ["003"]
---

## Description

Build the Supabase Edge Function `transcribe` that receives an audio file path (Supabase Storage), downloads the audio, sends it to OpenRouter for transcription (Whisper or equivalent), and updates the `thoughts` row with the transcript text and `transcription_status: 'complete'`. The `OPENROUTER_API_KEY` is stored as a Supabase project secret and never exposed to the client. The mobile app calls this function after uploading audio in task #006.

## Acceptance Criteria

- [ ] Supabase Edge Function `transcribe` created at `supabase/functions/transcribe/index.ts`
- [ ] Function authenticates caller via Supabase JWT (rejects unauthenticated requests)
- [ ] Function receives audio as `multipart/form-data` file upload directly from device (no Supabase Storage)
- [ ] Audio sent to OpenRouter transcription endpoint (model configurable via env var)
- [ ] Transcript text saved to `thoughts.body` (or `thoughts.body_transcribed` — to be decided in #001)
- [ ] `transcription_status` updated to `'complete'` on success, `'failed'` on error
- [ ] On failure: `transcription_status` set to `'failed'`, original thought remains accessible
- [ ] `docs/technical/API.md` `/transcribe` endpoint section updated with final implementation details
- [ ] Unit tests for the edge function logic (mock OpenRouter responses)

## Technical Notes

- OpenRouter transcription endpoint: see open question #1 in PRD.md — use a configurable model ID
- Store model ID as `OPENROUTER_TRANSCRIPTION_MODEL` Supabase secret for easy swapping
- Audio is sent as raw bytes in the request — no Supabase Storage download needed
- Max audio size: enforce a reasonable limit (e.g., 25MB) to prevent abuse
- Error handling: never delete the thought on transcription failure — log the error and set status

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |

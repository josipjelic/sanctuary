---
id: "006"
title: "Build quick capture screen (text input + voice recording UI)"
status: "completed"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: "2026-03-28"
completed_at: "2026-03-28"
prd_refs: ["FR-010", "FR-011", "FR-014", "FR-015", "FR-016"]
blocks: ["009", "014"]
blocked_by: ["002", "003", "004"]
---

## Description

Build the primary Quick Capture screen — the first thing users see after logging in. It provides a large, spacious text input for free-form thought capture, and a voice record button that initiates an audio recording. On submission, the thought is immediately saved to the `thoughts` table with `tagging_status: 'pending'`, and the user gets instant feedback (the thought appears in their inbox). Voice recordings are uploaded to Supabase Storage; transcription is triggered asynchronously (see task #007). The UI must reflect the "Serene Interface" design: breathtaking whitespace, no chrome, the input as the hero.

## Acceptance Criteria

- [x] Large, focused text input occupying most of the screen (min 60% viewport)
- [x] Capture button submits text immediately to `thoughts` table
- [x] Voice record button requests microphone permission, starts recording, shows timer
- [x] Stop recording sends audio directly to edge function `transcribe` (multipart/form-data — NOT uploaded to Storage)
- [x] New thought appears in inbox immediately after capture (success toast — no inbox screen yet)
- [x] `tagging_status` pending indicator deferred to inbox screen (task #009)
- [x] Empty submissions rejected with inline validation
- [x] Screen adheres to design system: parchment background, Manrope typography, no borders
- [x] Unit tests for capture form logic (21 tests, all passing)

## Technical Notes

- Use `expo-av` or `expo-audio` for voice recording
- Audio format: `.m4a` (iOS) / `.webm` (Android) — normalize in edge function if needed
- Audio stays on device — send raw bytes to `transcribe` edge function; discard after successful transcription
- Optimistic UI: insert thought immediately with empty body + transcription_status 'pending'; update body when transcript returns
- Do NOT block UI waiting for transcription — show "Transcribing…" indicator on the thought card

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |
| 2026-03-28 | @react-native-developer | Task completed — Quick Capture screen, expo-av voice recording, Thought types, capture utils + 21 tests |

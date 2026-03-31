---
id: "022"
title: "Architecture design: reminders subsystem"
status: "completed"
area: "infra"
agent: "@systems-architect"
priority: "high"
created_at: "2026-03-30"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: []
blocks: ["023", "024"]
blocked_by: []
---

## Description

Design the architecture for the AI Reminder Detection & Approval Workflow subsystem. This is the foundational design task that all implementation work depends on.

Deliverables:
- Select and document the push notification provider (Expo Push Notifications vs direct APNs/FCM — evaluate trade-offs given the Expo managed workflow).
- Define the AI detection pipeline placement: where `detect-reminders` fits relative to the existing `transcribe` → `assign-topics` chain. Must be non-blocking (reminder detection should not delay the capture confirmation the user sees).
- Define the scheduling strategy: how approved reminders get scheduled and delivered (Supabase scheduled functions, pg_cron, client-side scheduling, or a third-party scheduler).
- Write a new ADR (ADR-004) capturing the decision and its trade-offs.
- Update `docs/technical/ARCHITECTURE.md` with the reminders subsystem overview.

## Acceptance Criteria

- [ ] Push notification provider selected and justified with trade-off analysis.
- [ ] AI detection pipeline placement defined (timing relative to transcribe/assign-topics, blocking vs non-blocking contract).
- [ ] Scheduling strategy selected and justified (consider Supabase limitations: no native cron in hosted edge functions without pg_cron or external triggers).
- [ ] ADR-004 written and added to `docs/technical/DECISIONS.md` (Accepted status, following existing ADR format).
- [ ] `docs/technical/ARCHITECTURE.md` updated with a reminders subsystem section (data flow, component list, sequence sketch).
- [ ] No source code written — this task produces documentation and decisions only.
- [ ] Relevant documentation updated.

## Technical Notes

- Expo managed workflow favors Expo Push Notifications (`expo-notifications`) over direct APNs/FCM registration — verify this is still the right call for SDK 54.
- The scheduling problem is the highest-risk assumption: Supabase hosted projects do not expose pg_cron by default. Options include: Expo background fetch (unreliable), a Supabase Edge Function triggered by a webhook/cron from an external service (e.g. GitHub Actions cron, Supabase's own cron via `pg_cron` if available on the plan), or a client-side local notification scheduled at approval time (simplest, no server side needed for v1).
- Local notifications at approval time (Expo `scheduleNotificationAsync`) may be the v1 sweet spot: no server scheduling infrastructure, works offline, consistent with Expo managed workflow. Flag this to the human if it reduces scope significantly.
- This task must be complete before #024 (database schema) can start, because the schema depends on knowing the scheduling strategy (e.g. whether a `scheduled_at` column is sufficient or whether a separate scheduler state machine is needed).

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-30 | human | Task created |

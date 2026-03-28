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

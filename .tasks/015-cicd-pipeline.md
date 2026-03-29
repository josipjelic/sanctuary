---
id: "015"
title: "CI/CD pipeline for Expo builds (GitHub Actions)"
status: "todo"
area: "infra"
agent: "@cicd-engineer"
priority: "normal"
created_at: "2026-03-28"
due_date: null
started_at: null
completed_at: null
prd_refs: []
blocks: []
blocked_by: ["002"]
---

## Description

Set up a GitHub Actions CI pipeline that runs on every pull request: type checking, linting (Biome), and unit tests (Jest). Add an optional EAS Build trigger for creating development builds when merging to main. The pipeline should fail fast on type errors or linting violations and report status to the PR.

## Acceptance Criteria

- [ ] GitHub Actions workflow: runs on every PR and push to `main`
- [ ] CI steps: `pnpm install` → `pnpm run typecheck` → `pnpm run lint` → `pnpm test`
- [ ] PR status checks: CI must pass before merge
- [ ] Workflow uses pnpm caching to speed up installs
- [ ] Secrets: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` available as GitHub Actions secrets (test project values)
- [ ] Optional EAS Build: workflow dispatch trigger or merge-to-main trigger for development builds
- [ ] Workflow file at `.github/workflows/ci.yml`

## Technical Notes

- Use `pnpm/action-setup` for pnpm in GitHub Actions
- Node version: pin to 18.x or 20.x LTS in the workflow
- EAS Build requires `EXPO_TOKEN` secret and `eas-cli` installed
- Keep EAS Build optional (manual trigger) for now — can enable automatic builds after beta stabilizes

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-28 | human | Task created during onboarding |

---
id: "038"
title: "OCEAN onboarding: UX design"
status: "completed"
area: "design"
agent: "@ui-ux-designer"
priority: "high"
created_at: "2026-04-11"
due_date: null
started_at: "2026-04-11"
completed_at: "2026-04-11"
prd_refs: ["FR-060", "FR-070"]
blocks: ["041"]
blocked_by: ["037"]
---

## Description

Design the full OCEAN onboarding UX flow and the morning message card component.

Screens to design:
- Welcome screen (warm, brand-aligned intro)
- 5–7 question screens with progress stepper (questions feel reflective, not clinical)
- "Building your profile" loading state
- Completion/celebration screen
- MorningMessageCard component spec (placement, dismissal, refresh cadence)

## Acceptance Criteria

- [ ] .assets/onboarding-ocean-ux-spec.md created with full screen specs
- [ ] 5–7 questions written, each probing 1-2 OCEAN dimensions
- [ ] Progress stepper design specified
- [ ] Loading state specified
- [ ] Morning message card placement and behaviour specified
- [ ] ARCHITECTURE.md Design System section updated

## Technical Notes

- Design system tokens: colors.primary (#536253), surfaceParchment (#f9f9f8)
- Fonts: Manrope (display) + Plus Jakarta Sans (body)
- No border lines; separation via background color shifts
- Corner radius: xl (3rem) or lg (2rem) for cards

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-04-11 | human | Task created via orchestration |
| 2026-04-11 | @ui-ux-designer | Completed: created `.assets/onboarding-ocean-ux-spec.md` with full 4-screen onboarding UX spec and `MorningMessageCard` component spec; updated `docs/technical/ARCHITECTURE.md` Design System section with `OnboardingProgressStepper`, `QuestionCard`, and `MorningMessageCard` component entries |

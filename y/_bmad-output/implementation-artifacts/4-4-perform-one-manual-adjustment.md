# Story 4.4: Perform One Manual Adjustment

Status: review

## Story

As an organizer,
I want one limited manual adjustment,
so that I can handle a real-world exception while keeping fairness visible.

## Acceptance Criteria

1. Given generated teams are not locked, when I use manual adjustment, then I can make one valid player swap or move that preserves team size, and fairness recalculates immediately.
2. Given a version has been manually adjusted, when it is displayed, then it is marked manually adjusted, and additional manual adjustment is blocked for MVP.

## Tasks / Subtasks

- [x] Persist manual adjustment state (AC: 2)
  - [x] Add nullable `manual_adjustment` JSON field to saved team generation versions.
  - [x] Include manual adjustment data in shared/API generated version contracts.
- [x] Add backend manual adjustment behavior (AC: 1, 2)
  - [x] Add endpoint for a one-time manual swap on a saved version.
  - [x] Require organizer/admin access and an open match.
  - [x] Block locked versions.
  - [x] Block versions that already used manual adjustment.
  - [x] Validate one Team A player and one Team B player are swapped.
  - [x] Recalculate team totals, score components, fairness percentage, and explanation.
- [x] Add mobile manual adjustment UX (AC: 1, 2)
  - [x] Add manual swap panel to generated team detail.
  - [x] Let organizer choose one player from each team.
  - [x] Apply swap through backend and update the displayed saved version.
  - [x] Show adjusted badge and block additional manual changes for that version.
- [x] Verify story quality (AC: 1, 2)
  - [x] Focused API tests succeed.
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 4.1 persists generated teams as draft versions.
- Story 4.2 displays a saved version and server-owned fairness.
- Story 4.3 keeps previous versions available and blocks endless regeneration.
- Story 4.5 will lock official teams, so Story 4.4 blocks manual adjustment on locked versions but does not lock teams.

### Architecture Requirements

- Manual adjustment must be server-owned and persisted on the saved generation version.
- MVP implementation supports a cross-team swap, preserving equal team size by design.
- Fairness must be recalculated by the backend after the swap.
- Only one manual adjustment is allowed per generation version.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 4.4: Perform One Manual Adjustment]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#Smart Team Generator]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm --filter @fit-five/api test -- matches.service.spec.ts matches.controller.spec.ts`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm exec turbo build --force`
- `pnpm --filter @fit-five/api test:e2e`

### Completion Notes List

- Added `manual_adjustment` JSON persistence to team generation versions.
- Added manual adjustment contracts to shared API types.
- Added backend endpoint for a one-time cross-team player swap.
- Recalculated totals, score components, fairness percentage, and explanation after swap.
- Added mobile manual swap picker and adjusted marker.
- Added English/French copy for manual adjustment UX.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260605091000_add_manual_adjustment_to_team_generations/migration.sql
- apps/api/src/modules/matches/match.presenter.ts
- apps/api/src/modules/matches/matches.controller.ts
- apps/api/src/modules/matches/matches.controller.spec.ts
- apps/api/src/modules/matches/matches.service.ts
- apps/api/src/modules/matches/matches.service.spec.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/match.tsx
- packages/shared/src/api/matches.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/_bmad-output/implementation-artifacts/4-4-perform-one-manual-adjustment.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

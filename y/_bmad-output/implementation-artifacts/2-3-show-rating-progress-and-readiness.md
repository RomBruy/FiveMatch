# Story 2.3: Show Rating Progress And Readiness

Status: review

## Story

As a group member,
I want to see rating progress,
so that I know what is blocking team generation.

## Acceptance Criteria

1. Given I open Joueurs or a blocked Match state, when ratings are incomplete, then I see player rating counts and missing rating needs, and individual rating values remain anonymous by default.
2. Given confirmed match players all have at least 3 ratings, when I view the match readiness state, then the app shows that team generation is ready, and the organizer/admin can access generation.

## Tasks / Subtasks

- [x] Add shared readiness contracts and localization (AC: 1, 2)
  - [x] Define rating progress threshold and response types.
  - [x] Add French and English progress/ready copy.
  - [x] Expose mobile API helper for readiness summary.
- [x] Add API rating progress endpoint (AC: 1, 2)
  - [x] Require authenticated group player access.
  - [x] Return per-player rating counts and missing needs only.
  - [x] Return group readiness summary using threshold 3.
  - [x] Include current-user pending rating count without exposing rating values.
- [x] Add Joueurs progress UI (AC: 1)
  - [x] Show group readiness percent and ready/blocked state.
  - [x] Show each player rating count and missing count.
  - [x] Keep individual score values hidden from the progress display.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 2.1 added initial peer rating creation and duplicate/self protection.
- Story 2.2 added editable ratings until `lockedAt` is set.
- Team generation stories do not exist yet, so Story 2.3 should shape readiness data for future match-specific confirmed-player gates while implementing group-level Joueurs visibility now.

### Architecture Requirements

- Readiness is based on counts, not score exposure.
- The baseline threshold is 3 initial peer ratings per relevant player.
- Percentages exposed to users should be integer 0-100.
- Match-specific readiness will later use confirmed match players; group-level readiness can use the current group roster.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 2.3: Show Rating Progress And Readiness]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-10: Show rating progress]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Rating evolution pattern]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm exec prettier --write ...`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm exec turbo build --force`
- `pnpm --filter @fit-five/api test:e2e`

### Completion Notes List

- Added shared readiness threshold and response contracts for group rating progress.
- Added protected API readiness endpoint returning counts, missing needs, readiness percent, and current-user pending rating count.
- Kept readiness responses anonymous by returning no score values and no rater IDs.
- Added API unit coverage for threshold math, missing counts, current-user pending ratings, and anonymity.
- Updated the Joueurs tab with a group readiness card and per-player received/missing rating counters.
- Added local readiness count updates after a new rating submission so progress reacts immediately.

### File List

- apps/api/src/modules/ratings/ratings.controller.ts
- apps/api/src/modules/ratings/ratings.controller.spec.ts
- apps/api/src/modules/ratings/ratings.service.ts
- apps/api/src/modules/ratings/ratings.service.spec.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/joueurs.tsx
- packages/shared/src/api/ratings.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/\_bmad-output/implementation-artifacts/2-3-show-rating-progress-and-readiness.md
- y/\_bmad-output/implementation-artifacts/sprint-status.yaml

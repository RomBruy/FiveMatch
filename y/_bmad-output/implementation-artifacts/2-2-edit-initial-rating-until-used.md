# Story 2.2: Edit Initial Rating Until Used

Status: review

## Story

As a rater,
I want to adjust an initial peer rating before it affects locked team generation,
so that early mistakes can be corrected without corrupting history.

## Acceptance Criteria

1. Given I submitted an initial rating, when it has not been used in a confirmed team generation version, then I can edit the rating and the latest value is used for readiness and baseline calculations.
2. Given the rating has been used in a confirmed team generation version, when I try to edit it, then the edit is blocked and the app explains that the rating is locked because it affected official teams.

## Tasks / Subtasks

- [x] Add shared update rating contracts and localization (AC: 1, 2)
  - [x] Define update initial peer rating input/response types.
  - [x] Add French and English edit/locked copy.
  - [x] Expose mobile API helper for updating a rating.
- [x] Add API edit support (AC: 1, 2)
  - [x] Add protected update endpoint for current user's submitted rating.
  - [x] Reuse 0-100 validation and attribute-set normalization.
  - [x] Ensure only the original rater can edit their rating.
  - [x] Block edits when `lockedAt` is set.
- [x] Add mobile edit UX in Joueurs (AC: 1, 2)
  - [x] Allow editing already-submitted unlocked ratings.
  - [x] Pre-fill values from the existing rating.
  - [x] Disable locked ratings and explain why.
  - [x] Keep duplicate submissions blocked through the submit path.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 2.1 added `initial_peer_ratings` with `lockedAt` and unique `group + rater + rated` duplicate protection.
- Story 2.1 mobile Joueurs lists current-user ratings and blocks duplicate submit by state.
- No team generation locking story exists yet, so `lockedAt` is the future integration point for confirmed team versions.

### Architecture Requirements

- Edit behavior belongs in `apps/api/src/modules/ratings`.
- The API must enforce original-rater ownership and lock checks.
- The rating row should be updated in place until locked so readiness/baseline calculations naturally use the latest values.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 2.2: Edit Initial Rating Until Used]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-9: Submit one-time initial peer rating]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Rating integrity]

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

- Added shared update-rating request/response contracts plus French and English edit/locked copy.
- Added a protected `PUT /groups/:groupId/initial-peer-ratings/:ratingId` endpoint that only updates the current rater's own unlocked rating.
- Reused existing 0-100 normalization and attribute-set validation so updated rows remain compatible with baseline/readiness calculations.
- Added API unit coverage for unlocked edit-in-place and locked rating conflict behavior.
- Updated the Joueurs tab so unlocked submitted ratings can be reopened with saved values, while locked ratings are disabled with explanatory copy.

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
- y/\_bmad-output/implementation-artifacts/2-2-edit-initial-rating-until-used.md
- y/\_bmad-output/implementation-artifacts/sprint-status.yaml

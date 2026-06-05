# Story 4.3: Regenerate Up To Five Versions

Status: review

## Story

As an organizer,
I want to regenerate teams a limited number of times,
so that I can choose a good split without endless rerolling.

## Acceptance Criteria

1. Given teams are generated but not locked, when I tap Regenerate, then a new saved version is created, and the previous version remains available for comparison.
2. Given five versions have been generated, when I try to regenerate again, then regeneration is blocked, and the app explains the MVP regeneration limit.

## Tasks / Subtasks

- [x] Add shared regeneration contract (AC: 1, 2)
  - [x] Add version limit constant for mobile/shared UI.
  - [x] Add response contract for saved generation version lists.
- [x] Add backend version listing and regeneration cap (AC: 1, 2)
  - [x] Expose saved generation versions for a match.
  - [x] Return version limit and remaining count.
  - [x] Enforce a maximum of five saved versions server-side.
  - [x] Block regeneration once a generation is locked.
- [x] Add mobile regeneration UX (AC: 1, 2)
  - [x] Load all saved versions for the next match.
  - [x] Show Regenerate after the first saved version exists.
  - [x] Show version count against the MVP limit.
  - [x] Let users select previous versions to compare team details.
  - [x] Explain the five-version limit when reached.
- [x] Verify story quality (AC: 1, 2)
  - [x] Focused API tests succeed.
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 4.1 already persists every generated version with a `matchId + versionNumber` unique constraint.
- Story 4.2 displays one saved version in detail and keeps fairness server-owned.
- Story 4.5 will introduce locking, so Story 4.3 blocks regeneration if a locked version exists but does not create lock behavior yet.

### Architecture Requirements

- The backend must enforce the five-version cap; the mobile UI may pre-disable but cannot be the source of truth.
- Previously saved versions must stay queryable and selectable.
- The mobile app should compare versions by switching the displayed saved server payload, not recomputing teams locally.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 4.3: Regenerate Up To Five Versions]
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

- Added a shared five-version limit constant and saved-generation list response type.
- Added API list endpoint for all saved team generation versions on a match.
- Enforced the server-side maximum of five saved versions.
- Blocked regeneration once a locked version exists.
- Updated mobile Match screen to load saved versions, show Regenerate, display version count, and allow selecting previous versions.
- Added English/French copy for regeneration, version history, and the MVP limit.

### File List

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
- y/_bmad-output/implementation-artifacts/4-3-regenerate-up-to-five-versions.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

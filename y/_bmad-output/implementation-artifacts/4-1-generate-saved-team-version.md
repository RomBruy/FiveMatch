# Story 4.1: Generate Saved Team Version

Status: review

## Story

As an organizer,
I want to generate a fair saved team version,
so that the group can play with a trusted split.

## Acceptance Criteria

1. Given a match has a valid confirmed player pool and rating threshold complete, when I tap Generate, then the backend creates a saved team generation version, and the response includes Team A, Team B, team totals, fairness percentage, and simple explanation.
2. Given the algorithm runs, when it creates a version, then the API stores the algorithm input snapshot, score components, seed, and explanation data, and the mobile UI does not calculate fairness itself.

## Tasks / Subtasks

- [x] Add real team-generation algorithm package behavior (AC: 1, 2)
  - [x] Accept confirmed players, 0-100 ratings, generator style, goalkeeper mode, and seed.
  - [x] Generate balanced teams with equal sizes.
  - [x] Score candidates by rating gap, position imbalance, goalkeeper imbalance, and controlled randomness.
  - [x] Return team totals, fairness percentage, score components, and explanation.
- [x] Persist saved generation versions (AC: 1, 2)
  - [x] Add `team_generation_versions` schema and migration.
  - [x] Store Team A, Team B, totals, fairness, seed, input snapshot, score components, and explanation.
  - [x] Version saved generations per match.
- [x] Add protected generation API (AC: 1, 2)
  - [x] Add endpoint for match team generation.
  - [x] Enforce organizer/admin access.
  - [x] Block generation when confirmed pool is not full.
  - [x] Block generation when confirmed players are below the initial rating threshold.
- [x] Connect mobile Generate action (AC: 1, 2)
  - [x] Call backend generation endpoint from the Match screen.
  - [x] Display returned teams, backend totals, fairness, and explanation.
  - [x] Keep fairness calculation server-owned.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 3.4 added visible attendance lists, so Story 4.1 can rely on the confirmed player pool.
- Story 2.2 locks initial ratings only after they affect official teams, so draft generation should not set `lockedAt`; locking belongs to Story 4.5.
- Story 2.4 used group-level readiness temporarily; Story 4.1 moves hard enforcement into the backend against confirmed players.

### Architecture Requirements

- The backend is the source of truth for fairness, score components, and explanation.
- The mobile app must display generated data from the API response rather than calculating team fairness locally.
- Saved versions must retain enough input data to support review, regenerate, and lock stories.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 4.1: Generate Saved Team Version]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#Smart Team Generator]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm --filter @fit-five/algorithm test`
- `pnpm --filter @fit-five/api test -- matches.service.spec.ts matches.controller.spec.ts`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm exec turbo build --force`
- `pnpm --filter @fit-five/api test:e2e`

### Completion Notes List

- Replaced the algorithm package stub with a deterministic seeded team generator.
- Added `team_generation_versions` persistence for saved draft versions.
- Added a protected team-generation endpoint under match routes.
- Enforced full confirmed pool and initial rating threshold before generation.
- Stored team assignments, totals, fairness percentage, seed, input snapshot, score components, and explanation.
- Connected the mobile Match screen Generate action to the backend and displayed returned teams/fairness/explanation.

### File List

- apps/api/package.json
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260603221500_create_team_generation_versions/migration.sql
- apps/api/src/modules/matches/match.presenter.ts
- apps/api/src/modules/matches/matches.controller.ts
- apps/api/src/modules/matches/matches.controller.spec.ts
- apps/api/src/modules/matches/matches.service.ts
- apps/api/src/modules/matches/matches.service.spec.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/match.tsx
- packages/algorithm/src/index.ts
- packages/algorithm/src/index.spec.ts
- packages/shared/src/api/matches.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- pnpm-lock.yaml
- y/\_bmad-output/implementation-artifacts/4-1-generate-saved-team-version.md
- y/\_bmad-output/implementation-artifacts/sprint-status.yaml

# Story 4.5: Confirm And Lock Teams

Status: review

## Story

As an organizer,
I want to lock the selected team version,
so that the match has an official source of truth.

## Acceptance Criteria

1. Given a generated version exists, when I confirm teams, then that version becomes locked, and casual edits/regeneration are no longer available.
2. Given teams are locked, when score, MVP voting, opponent ratings, stats, or share assets are created, then they use the locked teams as the source of truth, and backend authorization enforces this rule.

## Tasks / Subtasks

- [x] Add shared lock contract (AC: 1, 2)
  - [x] Add confirm-team-generation response with locked match and generation.
  - [x] Export the contract for mobile/API consumers.
- [x] Add backend lock behavior (AC: 1, 2)
  - [x] Add endpoint to confirm a saved generation version.
  - [x] Require group membership and organizer/admin or match organizer authority.
  - [x] Lock the selected generation and match together.
  - [x] Make duplicate confirmation of the same locked source idempotent.
  - [x] Block confirmation when another generation is already locked.
  - [x] Preserve other saved draft versions for history/comparison.
- [x] Add mobile lock UX (AC: 1)
  - [x] Add confirm-and-lock action to generated team detail.
  - [x] Show locked official source state after confirmation.
  - [x] Disable regeneration and manual swaps after locking.
  - [x] Prefer the locked version on reload.
- [x] Verify story quality (AC: 1, 2)
  - [x] Focused API tests succeed.
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 4.1 persists generated teams as saved versions.
- Story 4.2 displays server-owned fairness and details.
- Story 4.3 limits regeneration to five saved versions and keeps previous drafts.
- Story 4.4 adds one manual swap per draft, and blocks adjustment on locked versions.

### Architecture Requirements

- Locking must be backend-owned because later score, MVP, opponent rating, statistics, history, and share assets must trust one official team source.
- Locking should update both `matches.status` and the selected `team_generation_versions.status`.
- Mobile may pre-disable generation/manual controls, but backend authorization and status checks are authoritative.
- Duplicate lock taps should be safe for MVP idempotency.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 4.5: Confirm And Lock Teams]
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

- Added shared/API/mobile contract for confirming a team generation.
- Added backend confirmation endpoint that locks the selected generation and match as the source of truth.
- Made duplicate confirmation of the same locked version idempotent.
- Blocked locking another version once an official version exists.
- Added mobile confirm-and-lock CTA, locked official state, regeneration block, and manual-swap closure after locking.
- Kept upcoming locked matches visible on reload and closed attendance actions once teams are official.
- Added English/French copy for the lock flow.

### File List

- apps/api/src/modules/matches/matches.controller.ts
- apps/api/src/modules/matches/matches.controller.spec.ts
- apps/api/src/modules/matches/matches.service.ts
- apps/api/src/modules/matches/matches.service.spec.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/match.tsx
- apps/mobile/src/features/matches/next-match-card.tsx
- packages/shared/src/api/matches.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/_bmad-output/implementation-artifacts/4-5-confirm-and-lock-teams.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

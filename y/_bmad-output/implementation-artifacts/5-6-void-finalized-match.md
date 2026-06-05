# Story 5.6: Void Finalized Match

Status: review

## Story

As an owner/admin,
I want to void a finalized match,
so that incorrect or invalid matches do not distort rankings.

## Acceptance Criteria

1. Given a match has been finalized, when an owner/admin voids it, then the match remains visible as voided in history, and it is excluded from leaderboards and rating evolution.
2. Given external share assets may already exist, when a match is voided, then in-app recap assets are marked voided, and the app does not promise to retract externally shared images.

## Tasks / Subtasks

- [x] Add voiding persistence and shared contract (AC: 1, 2)
  - [x] Add match void audit metadata.
  - [x] Add void markers to match player stats and rating history.
  - [x] Add `voided` match status and shared API voiding payload.
  - [x] Add database migration for voided matches.
- [x] Add backend voiding behavior (AC: 1)
  - [x] Require owner/admin role.
  - [x] Require a finalized completed match.
  - [x] Mark the match as voided without deleting score, teams, events, MVP votes, stats, or rating history.
  - [x] Mark match player stats and rating history rows as voided.
  - [x] Recompute affected players' aggregate rating state from remaining non-voided finalized stats.
  - [x] Make already-voided matches idempotent.
- [x] Add API/mobile flow (AC: 1, 2)
  - [x] Add `POST /groups/:groupId/matches/:matchId/void`.
  - [x] Add mobile API client helper.
  - [x] Add completed-match void action for owner/admin.
  - [x] Show voided match state in the match flow.
  - [x] Add copy that in-app recaps are voided and externally shared images cannot be retracted.
- [x] Verify story quality (AC: 1, 2)
  - [x] Focused API tests succeed.
  - [x] `pnpm exec turbo typecheck --force` succeeds.
  - [x] `pnpm exec turbo lint --force` succeeds.
  - [x] `pnpm exec turbo test --force` succeeds.
  - [x] `pnpm exec turbo build --force` succeeds.
  - [x] API e2e health check still passes.
  - [x] `git diff --check` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 5.5 added match finalization, player rating state, match player stats, and rating history.
- Voiding must not erase history; it must preserve the audit trail and remove the match from future stat/rating contribution.

### Architecture Requirements

- Voiding is owner/admin-only and backend-owned.
- Voided matches remain visible through status and audit metadata.
- Future leaderboards can exclude voided matches by filtering `match.status != "voided"` and/or stat/history `voidedAt == null`.
- Current aggregate rating state is recomputed from active non-voided finalized stats so a voided match no longer contributes to OVR, form, MVP counts, or stat totals.
- The app copy explicitly says externally shared images cannot be retracted.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 5.6: Void Finalized Match]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#Voided Match]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/addendum.md#Post-Match Data Correction]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm --filter @fit-five/api exec prisma generate`
- `pnpm --filter @fit-five/api test -- matches.service.spec.ts matches.controller.spec.ts`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm exec turbo build --force`
- `pnpm --filter @fit-five/api test:e2e`
- `git diff --check`

### Completion Notes List

- Added void audit columns on matches and void markers on stat/history rows.
- Added void endpoint that requires owner/admin and finalized completed match state.
- Voiding marks match player stats and rating history as voided, then recomputes affected player aggregates from remaining non-voided finalized stats.
- Added mobile void action in completed match state and a voided presentation with external-share notice.
- Added English/French localization for voided match states.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260605204500_void_finalized_matches/migration.sql
- apps/api/src/modules/matches/match-options.ts
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
- y/_bmad-output/implementation-artifacts/5-6-void-finalized-match.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

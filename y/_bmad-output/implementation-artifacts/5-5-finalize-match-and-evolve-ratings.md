# Story 5.5: Finalize Match And Evolve Ratings

Status: review

## Story

As a group member,
I want completed matches to update ratings and stats truthfully,
so that rankings reflect actual performance over time.

## Acceptance Criteria

1. Given score and match events are ready, when an organizer/admin finalizes the match, then stats, OVR, form, rating history, MVP counts, and leaderboards are updated, and OVR moves slower than form.
2. Given suspicious or extreme rating input exists, when rating evolution runs, then anti-abuse policy softens or ignores suspicious influence, and the rating history records the update.

## Tasks / Subtasks

- [x] Add finalization and rating persistence (AC: 1, 2)
  - [x] Add match finalization metadata.
  - [x] Add per-player rating state for OVR, form, lifetime stats, and MVP counts.
  - [x] Add per-match player stats.
  - [x] Add player rating history audit rows.
  - [x] Add database migration for new match finalization/rating tables.
- [x] Add backend finalization algorithm (AC: 1, 2)
  - [x] Require organizer/admin permission.
  - [x] Require locked match, locked team generation, and final score.
  - [x] Use locked teams as the official roster.
  - [x] Calculate goals, assists, result, MVP votes, and MVP awards.
  - [x] Apply median-distance filtering to soften suspicious extreme opponent ratings.
  - [x] Evolve OVR conservatively and form faster.
  - [x] Record rating-history reason payload with algorithm, weights, score, stat inputs, and anti-abuse details.
  - [x] Make completed-match finalization idempotent.
- [x] Add API/mobile flow (AC: 1)
  - [x] Add shared finalization contract and match finalization metadata.
  - [x] Add `POST /groups/:groupId/matches/:matchId/finalize`.
  - [x] Add mobile API client helper.
  - [x] Add Match screen finalization card.
  - [x] Keep completed score visible after finalization in the current session.
  - [x] Add English/French copy for finalization.
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

- Story 5.1 saves/edit final score before completion.
- Story 5.2 captures goals and assists against locked team players.
- Story 5.3 captures one MVP vote per confirmed locked-team player.
- Story 5.4 captures or skips quick opponent ratings.

### Architecture Requirements

- Finalization is backend-owned and writes durable audit history.
- OVR must move slower than form to keep player identity stable while still surfacing recent performance.
- Suspicious opponent ratings are softened using a median-distance filter before they influence performance score.
- Finalized match data becomes the source for Epic 6 leaderboards, player statistics, history, and summaries.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 5.5: Finalize Match And Evolve Ratings]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-23: Match finalization and rating evolution]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Historical auditability]

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

- Added match finalization metadata and persistent rating/stat/history tables.
- Added finalization endpoint that validates locked teams, score, and organizer/admin access.
- Added rating evolution algorithm with slow OVR movement, faster form movement, match stat boosts, MVP influence, and result adjustment.
- Added anti-abuse median-distance filtering for extreme opponent ratings and records the filter details in rating history.
- Added mobile finalization action card with completed state and bilingual copy.
- Finalized matches are idempotent to avoid applying rating evolution twice.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260605162000_finalize_matches_and_rating_history/migration.sql
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
- y/_bmad-output/implementation-artifacts/5-5-finalize-match-and-evolve-ratings.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

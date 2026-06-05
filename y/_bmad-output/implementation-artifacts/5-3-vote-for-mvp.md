# Story 5.3: Vote For MVP

Status: review

## Story

As a confirmed match player,
I want to vote once for MVP,
so that the group can recognize the best performer.

## Acceptance Criteria

1. Given MVP voting is open for a locked match, when I vote for a player who is not myself, then my vote is saved once, and duplicate votes are blocked.
2. Given I try to vote for myself or I was not confirmed in the match, when I submit a vote, then the vote is rejected, and the app explains the rule.

## Tasks / Subtasks

- [x] Add MVP vote persistence and shared contract (AC: 1, 2)
  - [x] Add `match_mvp_votes` persistence with voter, target, match, and timestamps.
  - [x] Add one-vote-per-match-per-voter database uniqueness.
  - [x] Add shared MVP vote type and submit request/response types.
  - [x] Include all MVP votes and the current user's vote in football match responses.
- [x] Add backend MVP voting behavior (AC: 1, 2)
  - [x] Add MVP vote endpoint for locked matches.
  - [x] Require voter to be a confirmed match player.
  - [x] Require voter and target player to belong to the locked teams.
  - [x] Reject self-votes.
  - [x] Reject duplicate votes.
- [x] Add mobile MVP vote UX (AC: 1, 2)
  - [x] Show MVP vote card after teams are locked.
  - [x] List locked-team players with live vote counts.
  - [x] Disable and label the current player to explain the self-vote rule.
  - [x] Show not-confirmed and already-voted explanations.
  - [x] Add English/French copy for the MVP vote flow.
- [x] Verify story quality (AC: 1, 2)
  - [x] Focused API tests succeed.
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] `pnpm build` succeeds.
  - [x] API e2e health check still passes.
  - [x] `git diff --check` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 4.5 locks the official team generation for post-match actions.
- Story 5.1 keeps the match in `locked` status after score entry until future finalization.
- Story 5.2 adds event/stat data but does not finalize aggregate player statistics yet.

### Architecture Requirements

- MVP votes are backend-owned and validated against locked team participants.
- The database enforces one vote per voter per match.
- The service rejects self-votes and duplicate votes before creating a row.
- Confirmed attendance is required to vote.
- The mobile UI shows the rule before submission, including disabled self-vote state and not-confirmed helper text.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 5.3: Vote For MVP]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-21: MVP voting]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/addendum.md#Post-Match Flow]

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
- `git diff --check`

### Completion Notes List

- Added `match_mvp_votes` Prisma model and migration.
- Added MVP vote payloads to shared match contracts.
- Added `POST /groups/:groupId/matches/:matchId/mvp-votes`.
- Backend validates locked match, confirmed voter attendance, locked-team voter/target, no self-vote, and no duplicate vote.
- Match payloads now include `mvpVotes` and `myMvpVote`.
- Mobile Match screen now shows a gold MVP vote card with vote counts, self-vote explanation, not-confirmed state, and already-voted state.
- Added French and English localization for MVP voting.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260605143100_create_match_mvp_votes/migration.sql
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
- y/_bmad-output/implementation-artifacts/5-3-vote-for-mvp.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

# Story 5.4: Submit Quick Opponent Rating

Status: review

## Story

As a confirmed match player,
I want to rate opponents quickly after the match,
so that future teams become more accurate without a long survey.

## Acceptance Criteria

1. Given post-match ratings are open, when I rate opponents, then I can submit one performance rating per opponent and optional tags, and teammates and self-rating are not allowed.
2. Given I choose to skip opponent ratings, when I skip, then the app lets me continue, and it shows a low-friction reminder that ratings improve future team generation.

## Tasks / Subtasks

- [x] Add opponent rating persistence and shared contract (AC: 1, 2)
  - [x] Add `match_opponent_ratings` persistence with rater, rated player, rating, tags, and timestamps.
  - [x] Add `match_opponent_rating_completions` persistence for submitted/skipped state.
  - [x] Add one-rating-per-opponent uniqueness.
  - [x] Add shared rating tags, completion status, submit, and skip contracts.
- [x] Add backend quick rating behavior (AC: 1, 2)
  - [x] Require locked match and locked team generation.
  - [x] Require rater to be a confirmed locked-team player.
  - [x] Require one rating for every opponent when submitting.
  - [x] Reject self, teammate, duplicate, missing-opponent, and unsupported-tag submissions.
  - [x] Allow confirmed players to skip and persist skipped completion.
- [x] Add mobile quick rating UX (AC: 1, 2)
  - [x] Show opponent rating card after teams are locked.
  - [x] Derive opponent list from the locked team version and current confirmed player.
  - [x] Provide 0-100 rating inputs and optional quick tags.
  - [x] Provide skip action with a reminder that ratings improve future team generation.
  - [x] Show submitted/skipped state after completion.
  - [x] Add English/French copy for the quick rating flow.
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

- Story 4.5 locks the official team split used to determine teammates and opponents.
- Story 5.3 added current-user match payload context (`myMvpVote`), which this story extends with `myOpponentRatingCompletion`.
- Rating evolution itself remains deferred to Story 5.5.

### Architecture Requirements

- Opponent ratings are backend-owned and validated against locked teams.
- A rater must be confirmed and must belong to a locked team.
- Submit requires all opponents; skip is an explicit persisted completion state.
- Tags use a shared allow-list so app copy and API validation stay aligned.
- The API avoids runtime imports from shared ESM inside Jest-tested backend code by keeping API runtime allow-lists local to match options.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 5.4: Submit Quick Opponent Rating]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-22: Quick opponent ratings]
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

- Added opponent rating and completion Prisma models plus migration.
- Added quick rating tags and completion contracts in shared API types.
- Added submit and skip opponent rating endpoints.
- Backend validates locked match, confirmed rater, locked-team membership, opponent-only targets, all-opponent completion, supported tags, and persisted skip state.
- Mobile Match screen now shows a compact quick opponent rating card with 0-100 inputs, optional tags, submit all, skip, and submitted/skipped state.
- Added French and English localization for quick opponent ratings.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260605145800_create_match_opponent_ratings/migration.sql
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
- y/_bmad-output/implementation-artifacts/5-4-submit-quick-opponent-rating.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

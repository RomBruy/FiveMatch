# Story 5.1: Submit And Edit Final Score

Status: review

## Story

As an organizer,
I want to submit the final score for locked teams,
so that the match result becomes official inside the group.

## Acceptance Criteria

1. Given teams are locked, when an organizer/admin submits Team A and Team B scores, then the result is saved idempotently, and all group members can view the score.
2. Given completion is not finalized, when an organizer/admin edits the score, then the corrected result is saved, and downstream finalization has not yet run.

## Tasks / Subtasks

- [x] Add score persistence and shared contract (AC: 1, 2)
  - [x] Add nullable match score fields and submitter audit fields.
  - [x] Add final score payload/response types.
  - [x] Include optional score in football match responses.
- [x] Add backend score behavior (AC: 1, 2)
  - [x] Add idempotent final score endpoint for locked matches.
  - [x] Require organizer/admin or match organizer authority.
  - [x] Require a locked team generation before accepting score.
  - [x] Allow score edits while match status is locked.
  - [x] Block score entry before locking teams or after future finalization.
- [x] Add mobile score UX (AC: 1, 2)
  - [x] Show score panel after teams are locked.
  - [x] Let organizer/admin enter Team A and Team B scores.
  - [x] Show saved score to all group members.
  - [x] Support editing the score before finalization.
- [x] Verify story quality (AC: 1, 2)
  - [x] Focused API tests succeed.
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 4.5 locks one team generation and the match as official source of truth.
- Score entry must use the locked teams; it must not reopen generation or manual adjustment.
- Match completion finalization is deferred to Story 5.5.

### Architecture Requirements

- Score submission is backend-owned and requires locked teams.
- The endpoint is idempotent for duplicate taps with the same score.
- The match remains `locked` after score submission; finalization will later move it to `completed`.
- All match readers receive the optional score from the standard football match payload.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 5.1: Submit And Edit Final Score]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-19: Submit final score]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/addendum.md#Match Completion and Correction]

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

- Added match-level final score persistence and submitter audit fields.
- Added optional score to every football match payload.
- Added idempotent final score API endpoint for locked matches.
- Blocked score entry before teams are locked and preserved future finalization boundaries by keeping scored matches in `locked` status.
- Added mobile locked-match score panel for organizer/admin entry and group-wide score visibility.
- Added English/French score entry copy.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260605095500_add_match_final_score/migration.sql
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
- y/_bmad-output/implementation-artifacts/5-1-submit-and-edit-final-score.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

# Story 5.2: Record Goals And Assists

Status: review

## Story

As an organizer,
I want to assign goals and assists to players,
so that player statistics reflect the match.

## Acceptance Criteria

1. Given a locked match has a submitted score, when I enter goals and assists, then I can assign counts to players from locked teams only, and invalid player assignments are rejected.
2. Given goals and assists are saved, when the match summary is viewed, then goalscorers and assists are displayed, and player statistics are ready for finalization.

## Tasks / Subtasks

- [x] Add match event persistence and shared contract (AC: 1, 2)
  - [x] Add `match_events` persistence with player, kind, count, recorder, and timestamps.
  - [x] Add shared goal/assist event types and upsert request/response types.
  - [x] Include saved events in every football match payload.
- [x] Add backend goal/assist behavior (AC: 1)
  - [x] Add idempotent endpoint for organizer/admin match event entry.
  - [x] Require locked match status and a submitted score.
  - [x] Require a locked team generation before accepting events.
  - [x] Reject players outside locked teams and duplicate input rows.
  - [x] Clear omitted or zeroed locked-player stats for safe corrections.
- [x] Add mobile goal/assist UX (AC: 1, 2)
  - [x] Show the stat entry panel after teams are locked and score is saved.
  - [x] Let organizer/admin enter goals and assists for locked-team players.
  - [x] Show saved goal/assist summaries to all group members.
  - [x] Add English/French copy for the stat flow.
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

- Story 5.1 adds final score submission while the match remains `locked`.
- Goals and assists must wait for the locked team generation and saved score to avoid assigning stats to a draft or stale team split.
- Match finalization, aggregate player statistics, and historical stat rollups are deferred to Story 5.5.

### Architecture Requirements

- Match events are backend-owned and validated against the locked team generation.
- Event writes are idempotent: resubmitting the same payload produces the same saved state.
- Zero-count rows are removed so organizer corrections do not leave stale stats.
- The mobile UI submits all locked-team players, letting empty inputs mean zero.
- All group members receive saved events through the standard match payload, while only organizer/admin can edit.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 5.2: Record Goals And Assists]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-20: Goals and assists]
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
- `git diff --check`

### Completion Notes List

- Added `match_events` Prisma model and migration for goal/assist counts.
- Added shared match event contracts and serialized events in football match responses.
- Added `PUT /groups/:groupId/matches/:matchId/events` for locked-match stat entry.
- Backend validates organizer/admin authority, locked match, submitted score, locked generation, locked-team player IDs, duplicate rows, and 0-99 counts.
- Mobile Match screen now shows a compact goals/assists panel after score submission and displays saved summaries to group members.
- Added French and English localization for the stat entry flow.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260605140500_create_match_events/migration.sql
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
- y/_bmad-output/implementation-artifacts/5-2-record-goals-and-assists.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

# Story 3.2: Submit Attendance Response

Status: review

## Story

As a player,
I want to respond In, Out, or Maybe in one tap,
so that the group knows whether I am playing.

## Acceptance Criteria

1. Given a match is open, when I tap In, Out, or Maybe, then my attendance response is saved idempotently, and the active state is clear in the Match Card.
2. Given I tap In before capacity is reached, when the response is saved, then I become a confirmed player, and the confirmed count updates.

## Tasks / Subtasks

- [x] Add shared attendance contracts and localization (AC: 1, 2)
  - [x] Define response/status types and submit response contract.
  - [x] Add French and English attendance action copy.
- [x] Add attendance persistence and API support (AC: 1, 2)
  - [x] Add `match_attendances` schema and migration.
  - [x] Add protected current-player attendance endpoint.
  - [x] Save responses idempotently by match/player.
  - [x] Confirm In players while capacity remains.
  - [x] Return updated match counts and current-user attendance.
- [x] Add mobile attendance controls (AC: 1, 2)
  - [x] Add In/Maybe/Out buttons on Match card.
  - [x] Show active response state.
  - [x] Update confirmed count after successful In response.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 3.1 added real match persistence and next-match cards.
- Story 3.2 should introduce player responses without full waitlist promotion rules; Story 3.3 handles richer waitlist movement.

### Architecture Requirements

- Attendance response writes must be idempotent by match and player.
- A player profile is required to respond.
- Confirmed count must update when an In response is accepted before capacity.
- Match cards should expose active current-player state without requiring chat.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 3.2: Submit Attendance Response]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-13: Submit attendance]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm exec prettier --write ...`
- `pnpm --filter @fit-five/api exec prisma format`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm exec turbo build --force`
- `pnpm --filter @fit-five/api test:e2e`

### Completion Notes List

- Added `match_attendances` persistence with one idempotent response row per match/player.
- Added attendance response/status contracts and localized In/Maybe/Out copy.
- Added protected API endpoint for current-player attendance submission.
- Confirmed In responses while capacity remains and returned updated confirmed/waitlist counts.
- Extended match responses with `myAttendance`.
- Added Match-card attendance buttons with active response/status display and optimistic replacement from API response.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260603151400_create_match_attendances/migration.sql
- apps/api/src/modules/matches/match-options.ts
- apps/api/src/modules/matches/match.presenter.ts
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
- y/\_bmad-output/implementation-artifacts/3-2-submit-attendance-response.md
- y/\_bmad-output/implementation-artifacts/sprint-status.yaml

# Story 3.4: Display Attendance Lists

Status: review

## Story

As a group member,
I want to see confirmed and waitlisted players,
so that match status is obvious without checking chat.

## Acceptance Criteria

1. Given I open the Match screen, when attendance exists, then I see confirmed players and waitlisted players using Player Row variants, and the count and status text do not rely on color alone.
2. Given the match has Maybe responses, when I view availability, then Maybe players are visible separately, and Maybe does not affect confirmed count or waitlist priority.

## Tasks / Subtasks

- [x] Extend match responses with attendance rows (AC: 1, 2)
  - [x] Add attendances to shared match contracts.
  - [x] Return all match attendance rows from match API responses.
  - [x] Keep confirmed and waitlist counts server-calculated.
- [x] Render attendance sections on the Match screen (AC: 1, 2)
  - [x] Display Confirmed, Waitlist, Maybe, and Out sections.
  - [x] Use player row variants with avatar/initial, name, subtitle, and explicit status badge.
  - [x] Sort waitlist rows by waitlist position.
  - [x] Show section counts and status text without relying on color alone.
- [x] Add focused coverage (AC: 1, 2)
  - [x] Cover match response serialization with attendances.
  - [x] Cover Maybe attendance visibility in the service response while keeping counts separate.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 3.3 made waitlist positions reliable and promoted the next waitlisted player when a confirmed spot opens.
- Story 3.4 should focus on visibility only; team generation remains blocked until Epic 4.

### Architecture Requirements

- The API should remain the source of truth for attendance statuses and counts.
- The mobile app can combine returned attendance rows with the already-loaded group roster to display player names/photos.
- Maybe and Out rows should be visible but must not influence confirmed capacity or waitlist order.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 3.4: Display Attendance Lists]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-13: Submit attendance]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm exec prettier --write ...`
- `pnpm --filter @fit-five/api test -- matches.service.spec.ts matches.controller.spec.ts`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm exec turbo build --force`
- `pnpm --filter @fit-five/api test:e2e`

### Completion Notes List

- Added all attendance rows to match API responses.
- Rendered Confirmed, Waitlist, Maybe, and Out sections on the Match screen.
- Matched attendance rows with the loaded group roster for player names/photos.
- Added explicit text badges and counts so attendance state does not rely on color alone.
- Added coverage for serialized attendances and Maybe visibility without affecting confirmed/waitlist counts.

### File List

- apps/api/src/modules/matches/match.presenter.ts
- apps/api/src/modules/matches/matches.controller.spec.ts
- apps/api/src/modules/matches/matches.service.ts
- apps/api/src/modules/matches/matches.service.spec.ts
- apps/mobile/src/app/(tabs)/match.tsx
- packages/shared/src/api/matches.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/\_bmad-output/implementation-artifacts/3-4-display-attendance-lists.md
- y/\_bmad-output/implementation-artifacts/sprint-status.yaml

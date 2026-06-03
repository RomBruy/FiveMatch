# Story 3.3: Manage Full Match Waitlist

Status: review

## Story

As a player,
I want to see my waitlist position when a match is full,
so that I know whether I might still play.

## Acceptance Criteria

1. Given a match is full, when I tap In, then I am added to the ordered waitlist, and the app shows my waitlist position.
2. Given a confirmed player cancels before teams lock, when a waitlisted player is next in line, then that player moves into confirmed status, and the waitlist order updates.

## Tasks / Subtasks

- [x] Extend waitlist rules in the attendance service (AC: 1, 2)
  - [x] Assign ordered waitlist positions when a full match receives another In response.
  - [x] Reconcile waitlist after every attendance change.
  - [x] Promote the first waitlisted player when a confirmed spot opens.
  - [x] Re-number remaining waitlisted players after promotion or removal.
- [x] Show current-player waitlist position in the mobile Match Card (AC: 1)
  - [x] Add localized waitlist-position copy.
  - [x] Display position number when the current player is waitlisted.
- [x] Add targeted service coverage (AC: 1, 2)
  - [x] Cover full-match In response creating a waitlist position.
  - [x] Cover confirmed cancellation promoting the first waitlisted player.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 3.2 added idempotent attendance responses and confirmed players while capacity remained.
- Story 3.3 builds on that by making the waitlist ordered, visible, and automatically reconciled when availability changes.

### Architecture Requirements

- Waitlist order must be deterministic and based on existing queue position, then response time, then creation time.
- Reconciliation must run after attendance changes so stale queue numbers do not leak to the app.
- Promotion must happen only while matches are still open; locked team generation comes later.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 3.3: Manage Full Match Waitlist]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-13: Submit attendance]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm exec prettier --write ...`
- `pnpm --filter @fit-five/api test -- matches.service.spec.ts`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm exec turbo build --force`
- `pnpm --filter @fit-five/api test:e2e`

### Completion Notes List

- Added waitlist reconciliation after every attendance response.
- Promoted first waitlisted player into confirmed status when a confirmed player cancels before teams lock.
- Re-numbered waitlist positions after promotion/removal using deterministic queue order.
- Displayed current-player waitlist position on the mobile Match Card.
- Added service tests for full-match waitlisting and automatic promotion.

### File List

- apps/api/src/modules/matches/matches.service.ts
- apps/api/src/modules/matches/matches.service.spec.ts
- apps/mobile/src/features/matches/next-match-card.tsx
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/\_bmad-output/implementation-artifacts/3-3-manage-full-match-waitlist.md
- y/\_bmad-output/implementation-artifacts/sprint-status.yaml

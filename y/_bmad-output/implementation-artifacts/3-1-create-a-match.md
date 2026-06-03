# Story 3.1: Create A Match

Status: review

## Story

As an organizer,
I want to create a match with football-specific settings,
so that players can confirm attendance for a specific session.

## Acceptance Criteria

1. Given I am an owner/admin organizer, when I create a match, then I can set title, date/time, location, team size, attendance deadline, generator style override, and goalkeeper mode override, and the max player count is calculated as players per team times two.
2. Given a match is created, when group members open Accueil or Match, then they see the next match card with date/time, location, format, and attendance status.

## Tasks / Subtasks

- [x] Add shared match contracts and localization (AC: 1, 2)
  - [x] Define create/list match response types.
  - [x] Add match format and status copy in French and English.
  - [x] Expose mobile API helpers for create/list next matches.
- [x] Add match persistence and API module (AC: 1, 2)
  - [x] Add `matches` schema and migration.
  - [x] Add protected create endpoint.
  - [x] Require owner/admin organizer role.
  - [x] Validate match fields and calculate max players.
  - [x] Add protected next-match endpoint for group members.
- [x] Add mobile match creation and next match cards (AC: 1, 2)
  - [x] Add create match form for active group organizers.
  - [x] Show next match card on Accueil.
  - [x] Show next match card on Match.
  - [x] Display date/time, location, format, and attendance placeholder.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Epic 2 created rating readiness and a Match-tab generation gate.
- Story 3.1 should introduce real match persistence without attendance responses yet.
- Attendance count can be displayed as a placeholder until Story 3.2 adds responses.

### Architecture Requirements

- Match creation requires owner/admin permission server-side.
- Max players must be calculated as `playersPerTeam * 2`.
- Presets include 5v5, 6v6, and 7v7, with custom sizes supported later by field value.
- Next match visibility is available to group members.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 3.1: Create A Match]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-12: Create match]

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

- Added `matches` persistence with organizer, kickoff, location, format, max players, attendance deadline, optional generator override, optional goalkeeper override, and status.
- Added protected API endpoints to create a match and fetch the next open future match for group members.
- Enforced owner/admin creation permission server-side and calculated `maxPlayers = playersPerTeam * 2`.
- Added mobile API helpers and shared match contracts.
- Added Match-tab create form for organizers with 5v5, 6v6, and 7v7 presets plus group-rule overrides.
- Added reusable next-match card shown on Accueil and Match with date/time, location, format, and attendance placeholder.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260603150000_create_matches/migration.sql
- apps/api/src/app.module.ts
- apps/api/src/modules/matches/match-options.ts
- apps/api/src/modules/matches/match.presenter.ts
- apps/api/src/modules/matches/matches.controller.ts
- apps/api/src/modules/matches/matches.controller.spec.ts
- apps/api/src/modules/matches/matches.module.ts
- apps/api/src/modules/matches/matches.service.ts
- apps/api/src/modules/matches/matches.service.spec.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/index.tsx
- apps/mobile/src/app/(tabs)/match.tsx
- apps/mobile/src/features/matches/next-match-card.tsx
- packages/shared/src/api/matches.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/\_bmad-output/implementation-artifacts/3-1-create-a-match.md
- y/\_bmad-output/implementation-artifacts/sprint-status.yaml

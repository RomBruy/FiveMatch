# Story 1.8: Complete Vestiaire Personality

Status: review

## Story

As a player,
I want to add funny locker-room personality details,
so that my profile and cards feel personal and fun.

## Acceptance Criteria

1. Given I edit my Vestiaire profile, when I add specialty, favorite excuse, bad-faith level, locker-room style, third-half profile, celebration, or legendary phrase, then the values are saved to my group player profile and can be used in profile/card flavor.
2. Given Vestiaire fields are saved, when team generation or OVR is calculated, then Vestiaire fields do not materially affect competitive balance and Fun remains social/card-oriented unless future product decisions change it.

## Tasks / Subtasks

- [x] Add shared Vestiaire contracts and localization (AC: 1, 2)
  - [x] Define Vestiaire field contracts and update input.
  - [x] Add French and English copy for the Vestiaire screen.
  - [x] Expose mobile API helper for saving Vestiaire personality.
- [x] Add Vestiaire persistence and API support (AC: 1, 2)
  - [x] Add Vestiaire columns to `players`.
  - [x] Add protected current-user Vestiaire update endpoint.
  - [x] Reuse group membership checks.
  - [x] Ensure Vestiaire fields do not write competitive OVR/rating data.
- [x] Add mobile Vestiaire UX (AC: 1, 2)
  - [x] Replace placeholder with first-group Vestiaire profile form.
  - [x] Support bad-faith level as a fun 0-100 value.
  - [x] Show completion/flavor status.
  - [x] Keep Vestiaire social/card-oriented in copy.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 1.7 added the `Player` model, protected group roster/profile endpoints, and first-group mobile profile loading.
- Player identity fields are intentionally separate from competitive OVR/rating data.
- The mobile Vestiaire tab is currently a placeholder, so this story can focus on personality completion.

### Architecture Requirements

- Store Vestiaire personality on the group-scoped `players` record.
- API code should remain in `apps/api/src/modules/players` because Vestiaire belongs to player profile data.
- Vestiaire data may feed future card flavor and social content, but must not participate in competitive balance.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 1.8: Complete Vestiaire Personality]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-8: Complete Vestiaire personality]
- [Source: y/_bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/EXPERIENCE.md#SR-4: Vestiaire]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm exec prettier --write ...`
- `pnpm --filter @fit-five/api exec prisma format`
- `pnpm --filter @fit-five/api prisma:generate`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm exec turbo build --force`
- `pnpm --filter @fit-five/api test:e2e`

### Completion Notes List

- Added Vestiaire fields to shared player contracts, including separate Vestiaire missing-field and completion status.
- Added bilingual Vestiaire copy and prompt suggestions for fast, fun data entry.
- Added nullable Vestiaire columns to `players` and a migration for social/card flavor fields.
- Added `PUT /groups/:groupId/players/me/vestiaire` using existing group membership protection.
- Added service/controller tests proving Vestiaire saves and does not write rating/OVR fields.
- Replaced the mobile Vestiaire placeholder with a first-group personality form, completion meter, quick chips, and 0-100 bad-faith selector.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260603083509_add_player_vestiaire_fields/migration.sql
- apps/api/src/modules/players/player-options.ts
- apps/api/src/modules/players/player.presenter.ts
- apps/api/src/modules/players/players.controller.ts
- apps/api/src/modules/players/players.controller.spec.ts
- apps/api/src/modules/players/players.service.ts
- apps/api/src/modules/players/players.service.spec.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/vestiaire.tsx
- packages/shared/src/api/players.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/_bmad-output/implementation-artifacts/1-8-complete-vestiaire-personality.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

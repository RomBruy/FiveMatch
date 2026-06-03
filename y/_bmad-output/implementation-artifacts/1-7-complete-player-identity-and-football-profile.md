# Story 1.7: Complete Player Identity And Football Profile

Status: review

## Story

As a player,
I want to complete my identity and football profile,
so that my group knows who I am and the app can display me correctly.

## Acceptance Criteria

1. Given I joined a group, when I edit my player profile, then I can save first name, last name, nickname, photo, bio/devise, dominant foot, jersey number, preferred style, and club de formation, and the roster displays my player identity.
2. Given profile information is incomplete, when I view my profile, then the app shows clear missing fields and it does not allow free-text profile claims to directly change competitive OVR.

## Tasks / Subtasks

- [x] Add shared player profile contracts and localization (AC: 1, 2)
  - [x] Define player profile, roster, update input, dominant foot, and preferred style types.
  - [x] Add missing-field names and profile form copy in French and English.
  - [x] Expose player API client helpers in mobile.
- [x] Add player persistence and API module (AC: 1, 2)
  - [x] Add `players` schema and migration.
  - [x] Add protected current-user player profile endpoint.
  - [x] Add protected current-user player profile upsert endpoint.
  - [x] Add protected group roster endpoint.
  - [x] Ensure user must be a group member to create/view player profiles.
- [x] Add mobile profile and roster UX (AC: 1, 2)
  - [x] Add player profile form to Profil.
  - [x] Show clear missing fields.
  - [x] Show roster identities in Joueurs.
  - [x] Keep profile identity separate from competitive OVR/rating.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 1.5 added invite acceptance and prompts users to create a player profile.
- Story 1.6 added group member management and backend role authorization.
- The app currently uses the first joined group as the active group in early MVP screens.

### Architecture Requirements

- API module should live in `apps/api/src/modules/players`.
- Mobile player features should live under existing profile/players screens for this MVP slice.
- Database should include `players`; attributes/statistics can arrive with rating/stat epics.
- OVR and attributes are calculated from ratings and match history, not free-text profile claims.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 1.7: Complete Player Identity And Football Profile]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-6: Complete player identity]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-7: Complete football profile]

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

- Added shared player profile contracts, localized player profile/roster copy, and mobile API helpers.
- Added Prisma `Player` persistence with member-scoped API endpoints for roster, current profile read, and current profile upsert.
- Added backend guardrails so only group members can create/read profiles and free-text identity fields do not write competitive OVR/rating data.
- Rebuilt the mobile Profil tab with account language controls plus player identity form, missing-field feedback, and first-group profile loading.
- Replaced the Joueurs placeholder with a bilingual roster screen showing player identity, photo/fallback, jersey, foot/style, and profile completeness.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260602202006_create_players/migration.sql
- apps/api/src/app.module.ts
- apps/api/src/modules/players/player-options.ts
- apps/api/src/modules/players/player.presenter.ts
- apps/api/src/modules/players/players.controller.ts
- apps/api/src/modules/players/players.controller.spec.ts
- apps/api/src/modules/players/players.module.ts
- apps/api/src/modules/players/players.service.ts
- apps/api/src/modules/players/players.service.spec.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/joueurs.tsx
- apps/mobile/src/app/(tabs)/profil.tsx
- packages/shared/src/api/players.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/_bmad-output/implementation-artifacts/1-7-complete-player-identity-and-football-profile.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

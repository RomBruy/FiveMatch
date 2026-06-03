# Story 2.1: Submit One-Time Initial Peer Rating

Status: review

## Story

As a group player,
I want to rate another player once on clear 0-100 attributes,
so that the group has a fair baseline before matches are played.

## Acceptance Criteria

1. Given I am a player in a group, when I rate another non-self player, then I can submit Overall, Speed, Attack, Technique, Defense, Physical, Stamina, and Fun values from 0-100, and duplicate ratings for the same rated player in the same group are blocked.
2. Given the rated player is a goalkeeper profile, when I rate them, then the goalkeeper attribute set is used and the stored values remain normalized to the 0-100 system.

## Tasks / Subtasks

- [x] Add shared initial peer rating contracts and localization (AC: 1, 2)
  - [x] Define standard and goalkeeper attribute keys.
  - [x] Define submit/list response types.
  - [x] Add French and English rating flow copy.
- [x] Add rating persistence and API module (AC: 1, 2)
  - [x] Add `initial_peer_ratings` schema and migration.
  - [x] Add protected submit endpoint.
  - [x] Add protected current-user submitted ratings endpoint.
  - [x] Block self-ratings and duplicates at API/domain level.
  - [x] Determine goalkeeper attribute set from rated player profile.
- [x] Add mobile Joueurs rating UX (AC: 1, 2)
  - [x] Add rating CTA for non-self players.
  - [x] Use standard attributes for outfield players.
  - [x] Use goalkeeper attributes for goalkeeper profiles.
  - [x] Persist submitted state after successful rating.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 1.7 added group-scoped players with preferred style, including `goalkeeper`.
- Story 1.8 kept social Vestiaire fields separate from competitive balance.
- The Joueurs tab already loads the first group roster and player profiles.

### Architecture Requirements

- Rating logic belongs in `apps/api/src/modules/ratings`.
- Duplicate prevention must be backed by a database unique constraint.
- Self-rating must be blocked in API/domain validation, not just the UI.
- Initial peer rating values remain 0-100 and anonymous to other users by default.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 2.1: Submit One-Time Initial Peer Rating]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-9: Submit one-time initial peer rating]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#FR-9 to FR-11: Initial peer ratings and generation block]

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

- Added shared standard and goalkeeper initial peer rating contracts with 0-100 values.
- Added `initial_peer_ratings` persistence with unique `group + rater + rated` duplicate protection.
- Added protected API endpoints to submit initial peer ratings and list current-user submitted ratings.
- Enforced group player requirement, no self-ratings, duplicate blocking, and goalkeeper attribute selection from rated player profile.
- Expanded the Joueurs tab with a quick rating composer using standard/GK attributes and local submitted-state feedback.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260603094128_create_initial_peer_ratings/migration.sql
- apps/api/src/app.module.ts
- apps/api/src/modules/ratings/initial-peer-rating.presenter.ts
- apps/api/src/modules/ratings/rating-options.ts
- apps/api/src/modules/ratings/ratings.controller.ts
- apps/api/src/modules/ratings/ratings.controller.spec.ts
- apps/api/src/modules/ratings/ratings.module.ts
- apps/api/src/modules/ratings/ratings.service.ts
- apps/api/src/modules/ratings/ratings.service.spec.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/joueurs.tsx
- packages/shared/src/api/ratings.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/_bmad-output/implementation-artifacts/2-1-submit-one-time-initial-peer-rating.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

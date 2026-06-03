# Story 1.5: Invite And Join Group

Status: review

## Story

As a group owner or admin,
I want to share invite links,
so that players can join the private group easily.

## Acceptance Criteria

1. Given I am a group owner or admin, when I create an invite link, then the link can be shared outside the app and the backend records the invitation state.
2. Given an invited user opens a valid invite link, when they authenticate and accept the invite, then they become a group member and they are prompted to create their player profile.

## Tasks / Subtasks

- [x] Add shared invitation contracts and localization (AC: 1, 2)
  - [x] Define invitation response and accept/create request shapes.
  - [x] Add invitation link/code states and next-action copy in French and English.
  - [x] Expose invite/join API client helpers in mobile.
- [x] Add invitation persistence and authorization (AC: 1, 2)
  - [x] Add `invitations` schema and migration.
  - [x] Allow only group owner/admin members to create group invitations.
  - [x] Store invite token, creator, status, and accepted state.
  - [x] Accept valid invitations transactionally and create member role `member`.
- [x] Add mobile invite and join flow (AC: 1, 2)
  - [x] Show invite generation/share controls for owner/admin on Accueil.
  - [x] Show invite code/link after creation and use native sharing.
  - [x] Let authenticated users accept an invite code.
  - [x] Show prompt to create player profile after accepting.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 1.4 added `groups`, `group_settings`, `group_members`, protected group creation/listing, and mobile Accueil group state.
- Current group roles are `owner`, `admin`, and `member`.
- Player profile creation is scheduled for Story 1.7, so this story should prompt the user toward that next step without building the full profile form.

### Architecture Requirements

- API module should remain in `apps/api/src/modules/groups`.
- Database should include `invitations` for FR-3 to FR-5.
- Backend must enforce group owner/admin authorization for invite creation.
- Routes should use REST nouns under `/api/v1`, with nested group invite creation and token-based invite acceptance.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 1.5: Invite And Join Group]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-4: Invite and join group]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#FR-3 to FR-5: Groups, invites, roles, settings]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm --filter @fit-five/api prisma:generate`
- `pnpm --filter @fit-five/api exec prisma format`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm --filter @fit-five/api test:e2e`
- `pnpm build`
- `pnpm exec turbo typecheck lint test --force`

### Completion Notes List

- Added shared invitation types, invite status, accept next-action, and bilingual invite/join copy.
- Added `invitations` Prisma model and migration with token, creator, status, usage count, and last accepted timestamp.
- Added protected `POST /api/v1/groups/:groupId/invitations` for owner/admin invite creation.
- Added protected `POST /api/v1/invitations/:token/accept` for authenticated invite acceptance.
- Invite acceptance runs in a transaction, records usage, and creates `member` membership if needed.
- Mobile Accueil now supports generating/sharing invite links for owner/admin and accepting invite codes/links for users without a group.
- After accepting an invite, mobile shows a prompt toward player profile creation, leaving the actual profile form for Story 1.7.

### File List

- apps/api/prisma/migrations/20260602184552_create_invitations/migration.sql
- apps/api/prisma/schema.prisma
- apps/api/src/modules/groups/group-options.ts
- apps/api/src/modules/groups/group.presenter.ts
- apps/api/src/modules/groups/groups.controller.spec.ts
- apps/api/src/modules/groups/groups.controller.ts
- apps/api/src/modules/groups/groups.module.ts
- apps/api/src/modules/groups/groups.service.spec.ts
- apps/api/src/modules/groups/groups.service.ts
- apps/api/src/modules/groups/invitations.controller.spec.ts
- apps/api/src/modules/groups/invitations.controller.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/index.tsx
- packages/shared/src/api/groups.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts

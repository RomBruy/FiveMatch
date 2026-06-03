# Story 1.4: Create A Private Football Group

Status: review

## Story

As an organizer,
I want to create a private group with football settings,
so that my friends can organize matches with the right rules.

## Acceptance Criteria

1. Given I am authenticated and have no group selected, when I create a group, then I can set name, default language, play style, intensity, goalkeeper mode, and default generator style, and I become the group owner.
2. Given the group is created, when I open Accueil, then I see the group identity and next recommended action, and no empty technical state is shown.

## Tasks / Subtasks

- [x] Add shared group contracts and localization (AC: 1, 2)
  - [x] Define group option types and API response/request shapes.
  - [x] Add French and English labels for group creation, group state, and recommended actions.
  - [x] Keep invalid or missing localized values safe through existing fallback behavior.
- [x] Add group persistence to the API (AC: 1)
  - [x] Add `groups`, `group_settings`, and `group_members` schema.
  - [x] Add protected group creation endpoint.
  - [x] Add protected current-user group listing endpoint for Accueil.
  - [x] Ensure the creator is inserted as owner membership transactionally.
- [x] Add mobile Accueil create-group UX (AC: 1, 2)
  - [x] Show a friendly create-group flow when no group exists.
  - [x] Collect group name and required football settings.
  - [x] Persist the group through the authenticated API.
  - [x] Show group identity and next recommended action after creation.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 1.3 added app/account locale preferences, shared localization dictionaries, and authenticated API preference updates.
- Mobile protected screens already have access to Clerk tokens through `useAuth`.
- API protected endpoints use `ClerkAuthGuard` and `AuthenticatedRequest`.
- Prisma is pinned to 6.19.0 for local Node 20.17 compatibility.

### Architecture Requirements

- API module should live in `apps/api/src/modules/groups`.
- Mobile group features should live under `apps/mobile/src/features/groups` where reusable.
- Database owns group membership and roles with `groups`, `group_settings`, and `group_members`.
- Authenticated group access must depend on internal FiveMatch authorization, not only Clerk auth.
- Routes should use plural REST nouns under `/api/v1`, starting with `/api/v1/groups`.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 1.4: Create A Private Football Group]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-3: Create group]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#FR-3 to FR-5: Groups, invites, roles, settings]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm --filter @fit-five/api prisma:generate`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm --filter @fit-five/api test:e2e`
- `pnpm build`
- `pnpm exec turbo typecheck lint test --force`

### Completion Notes List

- Added shared group option constants and typed create/list API contracts.
- Added French and English group creation, option, active group, and next-action labels.
- Added Prisma models and migration for `groups`, `group_settings`, and `group_members`.
- Added protected `GET /api/v1/groups` and `POST /api/v1/groups` endpoints.
- Group creation runs in a transaction and creates the owner membership with role `owner`.
- Added API unit tests for group creation, listing, serialization, and invalid option rejection.
- Replaced the Accueil technical placeholder with a mobile create-group flow and active group summary.

### File List

- apps/api/prisma/migrations/20260531215540_create_groups/migration.sql
- apps/api/prisma/schema.prisma
- apps/api/src/app.module.ts
- apps/api/src/modules/groups/group-options.ts
- apps/api/src/modules/groups/group.presenter.ts
- apps/api/src/modules/groups/groups.controller.spec.ts
- apps/api/src/modules/groups/groups.controller.ts
- apps/api/src/modules/groups/groups.module.ts
- apps/api/src/modules/groups/groups.service.spec.ts
- apps/api/src/modules/groups/groups.service.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/index.tsx
- packages/shared/src/api/groups.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts

# Story 1.6: Manage Group Roles And Settings

Status: review

## Story

As a group owner,
I want to manage members, roles, and group settings,
so that the group can adapt without breaking match history.

## Acceptance Criteria

1. Given I am the group owner, when I update play style, goalkeeper mode, intensity, or generator style, then future matches use the new settings and existing locked match history remains unchanged.
2. Given I manage members, when I change a member role or remove a member, then backend authorization reflects the change immediately and unauthorized users cannot perform owner/admin actions.

## Tasks / Subtasks

- [x] Add shared management contracts and localization (AC: 1, 2)
  - [x] Define update settings, member list, role update, and removal response shapes.
  - [x] Add French and English labels for group settings and member management.
  - [x] Expose settings/member API client helpers in mobile.
- [x] Add backend authorization and persistence (AC: 1, 2)
  - [x] Add protected settings update endpoint.
  - [x] Add protected group members listing endpoint.
  - [x] Add protected member role update endpoint.
  - [x] Add protected member removal endpoint.
  - [x] Enforce owner/admin settings authorization and owner-only role/removal authorization.
- [x] Add mobile management controls (AC: 1, 2)
  - [x] Show editable group settings for owner/admin on Accueil.
  - [x] Show members and role/removal actions for owner.
  - [x] Refresh local group/member state after successful changes.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 1.4 added group settings and owner membership creation.
- Story 1.5 added reusable invite links and member joining.
- Current group roles are `owner`, `admin`, and `member`.
- There are no matches or locked match history tables yet, so settings updates should only mutate group settings and leave future match logic ready to consume the latest settings.

### Architecture Requirements

- FiveMatch API owns group roles and permissions.
- Backend guards must enforce owner/admin/member authorization, not only mobile UI.
- Owner/admin-only operations include group settings and membership management.
- Changing group settings affects future team generation; existing locked match history should be preserved once match tables exist.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 1.6: Manage Group Roles And Settings]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-5: Manage group roles and settings]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Authorization pattern]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm --filter @fit-five/api test:e2e`
- `pnpm build`
- `pnpm exec turbo typecheck lint test --force`

### Completion Notes List

- Added shared settings/member management contracts and bilingual Accueil management copy.
- Added protected `PATCH /api/v1/groups/:groupId/settings` for owner/admin setting updates.
- Added protected `GET /api/v1/groups/:groupId/members` for group member visibility.
- Added protected `PATCH /api/v1/groups/:groupId/members/:memberId/role` and `DELETE /api/v1/groups/:groupId/members/:memberId`.
- Settings updates are authorized for owner/admin and only mutate group settings, preserving future locked match history once match tables exist.
- Role changes/removal are owner-only, and owner membership cannot be demoted or removed.
- Mobile Accueil now includes editable group settings for owner/admin and member management for owners.

### File List

- apps/api/src/modules/groups/group-options.ts
- apps/api/src/modules/groups/group.presenter.ts
- apps/api/src/modules/groups/groups.controller.spec.ts
- apps/api/src/modules/groups/groups.controller.ts
- apps/api/src/modules/groups/groups.service.spec.ts
- apps/api/src/modules/groups/groups.service.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/index.tsx
- packages/shared/src/api/groups.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts

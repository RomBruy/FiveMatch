# Story 1.3: Manage Account Language And Preferences

Status: review

## Story

As a user,
I want to set my account language and basic preferences,
so that the app feels natural in French or English.

## Acceptance Criteria

1. Given I am authenticated, when I open my profile settings, then I can choose French or English as my app language and the choice persists across app restarts.
2. Given the app language is changed, when I view core navigation and settings screens, then user-facing labels use the selected language and missing translations fall back safely.

## Tasks / Subtasks

- [x] Add shared localization foundation (AC: 1, 2)
  - [x] Add supported locale types and helpers.
  - [x] Expand French and English dictionaries for navigation, profile settings, auth, and health text.
  - [x] Add safe fallback behavior for missing/invalid locale values.
- [x] Persist language preference in the mobile app (AC: 1, 2)
  - [x] Add a preferences provider using secure local storage.
  - [x] Load the stored locale on app start.
  - [x] Expose locale setter and localized strings to protected screens.
- [x] Add profile language selector UX (AC: 1, 2)
  - [x] Add French/English controls on the Profil screen.
  - [x] Update core tab labels and profile settings labels when language changes.
  - [x] Keep sign-out and auth/config messages localized where practical.
- [x] Persist account preference through the API (AC: 1)
  - [x] Add `preferred_locale` to the internal users schema.
  - [x] Add protected endpoint to update current user's account preferences.
  - [x] Include preferred locale in current-user response shapes.
  - [x] Add unit tests for preference persistence.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.

## Dev Notes

### Previous Story Intelligence

- Story 1.2 added Clerk auth, `SessionBootstrap`, API bearer support, Prisma users table, and `POST /api/v1/auth/sync`.
- Mobile uses Expo SecureStore already through Clerk; we can also use it for non-secret user preferences.
- API auth/user modules already have a current authenticated Clerk subject via `ClerkAuthGuard`.
- Prisma is pinned to 6.19.0 for local Node 20.17 compatibility.

### Architecture Requirements

- French and English localization must exist from the beginning.
- Personal app language can differ from group default language and future export language.
- Shared localization should live in `packages/shared/src/localization`.
- Secure local storage may hold minimal app preferences.
- Backend owns authenticated account preferences for cross-device persistence.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 1.3: Manage Account Language And Preferences]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-2: Account and language preferences]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Requirements To Structure Mapping]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm exec turbo typecheck lint test --force`
- `pnpm --filter @fit-five/api test:e2e`
- `pnpm build`

### Completion Notes List

- Added shared French/English localization dictionaries, supported locale helpers, and safe fallback normalization.
- Added a mobile preferences provider backed by Expo SecureStore so the selected language survives app restarts.
- Localized auth, loading, missing-config, tab navigation, placeholder, health, and profile preference labels.
- Added profile language controls that update the local app language immediately and persist the account preference through the authenticated API.
- Added `preferred_locale` to the users schema and exposed protected `PATCH /api/v1/users/me/preferences`.
- Added API unit coverage for auth sync serialization, preference persistence, and unsupported locale rejection.

### File List

- apps/api/prisma/migrations/20260531213134_create_users/migration.sql
- apps/api/prisma/schema.prisma
- apps/api/src/modules/auth/auth.controller.spec.ts
- apps/api/src/modules/auth/auth.controller.ts
- apps/api/src/modules/users/user-preferences.ts
- apps/api/src/modules/users/user.presenter.ts
- apps/api/src/modules/users/users.controller.spec.ts
- apps/api/src/modules/users/users.controller.ts
- apps/api/src/modules/users/users.module.ts
- apps/api/src/modules/users/users.service.spec.ts
- apps/api/src/modules/users/users.service.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(auth)/sign-in.tsx
- apps/mobile/src/app/(tabs)/_layout.tsx
- apps/mobile/src/app/(tabs)/index.tsx
- apps/mobile/src/app/(tabs)/joueurs.tsx
- apps/mobile/src/app/(tabs)/match.tsx
- apps/mobile/src/app/(tabs)/profil.tsx
- apps/mobile/src/app/(tabs)/vestiaire.tsx
- apps/mobile/src/app/_layout.tsx
- apps/mobile/src/components/placeholder-screen.tsx
- apps/mobile/src/features/auth/auth-loading-screen.tsx
- apps/mobile/src/features/auth/missing-auth-config-screen.tsx
- apps/mobile/src/features/auth/session-bootstrap.tsx
- apps/mobile/src/features/preferences/preferences-context.tsx
- packages/shared/src/api/responses.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- packages/shared/src/localization/index.ts

# Story 1.2: Authenticate With Native Sign-In

Status: review

## Story

As a new user,
I want to sign in with Google, Apple, or email/password,
so that I can securely access my football groups.

## Acceptance Criteria

1. Given I open the app unauthenticated, when I choose Google, Apple, or email/password sign-in, then I can complete authentication through the native app flow and the backend creates or links my internal user record.
2. Given I am authenticated, when I reopen the app, then my session is restored and protected screens do not show unauthenticated content.

## Tasks / Subtasks

- [x] Add Clerk native auth dependencies and environment configuration (AC: 1, 2)
  - [x] Add Clerk Expo SDK and secure token storage dependencies to the mobile app.
  - [x] Add Clerk backend verification dependency to the API.
  - [x] Document required Clerk environment variables.
- [x] Implement protected mobile app shell (AC: 1, 2)
  - [x] Wrap Expo Router in `ClerkProvider` with secure token cache.
  - [x] Add auth route group with sign-in screen.
  - [x] Move tabs into a protected route group.
  - [x] Restore sessions across app restarts using Clerk token cache.
  - [x] Prevent protected tabs from rendering unauthenticated content.
- [x] Sync authenticated user to FiveMatch API (AC: 1)
  - [x] Add mobile auth-aware API client token support.
  - [x] Call a backend sync endpoint after sign-in/session restore.
  - [x] Show sync state/errors without blocking Clerk session restoration forever.
- [x] Implement API auth and user mapping foundation (AC: 1)
  - [x] Add Prisma schema for internal `users` records mapped to Clerk user IDs.
  - [x] Add Prisma service/module foundation.
  - [x] Add Clerk token verification guard.
  - [x] Add `POST /api/v1/auth/sync` to create/link current internal user.
  - [x] Add unit tests for user sync behavior.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm install` succeeds.
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API auth/unit tests pass.

## Dev Notes

### Previous Story Intelligence

- Story 1.1 initialized the workspace at the project root with Expo SDK 56, Expo Router under `apps/mobile/src/app`, NestJS API under `apps/api`, shared API types, and Turbo validation scripts.
- Mobile lint uses `eslint src` instead of `expo lint` because Expo telemetry writes to `~/.expo` in this sandbox.
- API e2e tests that open a Supertest listener need elevated sandbox permissions.
- Keep BMad artifacts under `y/_bmad-output` intact.

### Architecture Requirements

- Use Clerk as the native authentication provider for Expo.
- FiveMatch API owns internal authorization and group roles.
- Backend stores an internal `users` row mapped to the external Clerk auth subject.
- Mobile UI may hide unauthenticated content, but backend guards remain authoritative.
- Mobile auth files should live under `apps/mobile/src/features/auth` and `apps/mobile/src/app/(auth)`.
- API auth/user files should live under `apps/api/src/modules/auth` and `apps/api/src/modules/users`.

### Current Official Docs Checked

- Clerk Expo quickstart recommends `@clerk/expo`, `expo-secure-store`, `ClerkProvider`, and `tokenCache` for session persistence.
- Expo's Clerk guide documents native auth choices and shows `AuthView` from `@clerk/expo/native` for a complete native sign-in/sign-up interface.
- Clerk `useAuth()` returns `getToken()` for calling external APIs with a bearer token.
- Clerk backend `verifyToken()` verifies Clerk-generated JWTs with `CLERK_JWT_KEY` or `CLERK_SECRET_KEY`.

### Auth Flow Contract

Mobile:

1. Root layout wraps the app in Clerk.
2. Unauthenticated users are redirected to `/(auth)/sign-in`.
3. Authenticated users are redirected into protected tabs.
4. After sign-in/session restore, mobile calls `POST /api/v1/auth/sync` with a Clerk bearer token.

API:

```http
POST /api/v1/auth/sync
Authorization: Bearer <clerk-session-token>
```

Expected success shape:

```json
{
  "data": {
    "user": {
      "id": "internal-user-id",
      "clerkUserId": "user_xxx"
    }
  }
}
```

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 1.2: Authenticate With Native Sign-In]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Requirements To Structure Mapping]
- Clerk Expo quickstart: https://clerk.com/docs/expo/getting-started/quickstart
- Expo using Clerk guide: https://docs.expo.dev/guides/using-clerk/
- Clerk `useAuth()` Expo docs: https://clerk.com/docs/expo/reference/hooks/use-auth
- Clerk `verifyToken()` backend docs: https://clerk.com/docs/reference/backend/verify-token

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Installed `@clerk/expo`, `expo-secure-store`, `expo-auth-session`, `expo-dev-client`, `expo-crypto`, and `expo-apple-authentication` for the native auth foundation.
- Installed `@clerk/backend` for API-side Clerk token verification.
- Prisma 7.8 generated an `ERR_REQUIRE_ESM` failure on the local Node 20.17 runtime, so Prisma was pinned to 6.19.0 for this workspace. Future upgrade can happen alongside a Node upgrade.
- Prisma engine download required network escalation once; subsequent `prisma generate` runs through the API package scripts.
- API e2e still requires sandbox escalation because Supertest opens an ephemeral local listener.

### Completion Notes List

- Added Clerk provider with secure token cache at the Expo root layout.
- Added `/(auth)/sign-in` route using Clerk native `AuthView` for sign-in/sign-up flows including configured social providers.
- Moved FiveMatch tabs into protected `/(tabs)` route group and redirect unauthenticated users to sign-in.
- Added mobile session bootstrap to call `POST /api/v1/auth/sync` after sign-in or restored session.
- Added auth-aware API client bearer token support.
- Added Prisma `users` model keyed by `clerk_user_id` and Prisma service/module foundation.
- Added API `ClerkAuthGuard` and `AuthController` sync endpoint.
- Added unit tests for auth sync serialization and user upsert behavior.
- Validation passed: `pnpm exec turbo typecheck --force`, `pnpm exec turbo lint --force`, `pnpm exec turbo test --force`, elevated `pnpm --filter @fit-five/api test:e2e`, and `pnpm build`.

### File List

- `.env.example`
- `.gitignore`
- `docs/runbooks/local-development.md`
- `infra/docker-compose.local.yml`
- `package.json`
- `pnpm-lock.yaml`
- `apps/api/package.json`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/auth/auth.controller.spec.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/auth.types.ts`
- `apps/api/src/modules/auth/clerk-auth.guard.ts`
- `apps/api/src/modules/prisma/prisma.module.ts`
- `apps/api/src/modules/prisma/prisma.service.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/users/users.service.spec.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/mobile/app.json`
- `apps/mobile/package.json`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/app/(auth)/_layout.tsx`
- `apps/mobile/src/app/(auth)/sign-in.tsx`
- `apps/mobile/src/app/(tabs)/_layout.tsx`
- `apps/mobile/src/app/(tabs)/index.tsx`
- `apps/mobile/src/app/(tabs)/joueurs.tsx`
- `apps/mobile/src/app/(tabs)/match.tsx`
- `apps/mobile/src/app/(tabs)/profil.tsx`
- `apps/mobile/src/app/(tabs)/vestiaire.tsx`
- `apps/mobile/src/app/_layout.tsx`
- `apps/mobile/src/env.d.ts`
- `apps/mobile/src/features/auth/auth-loading-screen.tsx`
- `apps/mobile/src/features/auth/missing-auth-config-screen.tsx`
- `apps/mobile/src/features/auth/session-bootstrap.tsx`
- `packages/shared/src/api/responses.ts`
- `packages/shared/src/index.ts`

# Story 1.1: Initialize Native App And API Workspace

Status: review

## Story

As a product team,
I want the FiveMatch mobile/API monorepo initialized,
so that every future feature has the correct native, backend, shared, and algorithm foundations.

## Acceptance Criteria

1. Given the repository is empty of implementation code, when the workspace is initialized, then it contains `apps/mobile`, `apps/api`, `packages/shared`, `packages/algorithm`, and `packages/config`, and root scripts support typecheck, lint, test, and development commands.
2. Given the mobile and API apps are initialized, when a developer runs the local health flow, then the API exposes a health endpoint, and the mobile app can call it through the shared API client.

## Tasks / Subtasks

- [x] Create the TypeScript monorepo foundation (AC: 1)
  - [x] Initialize pnpm workspace and Turborepo at the repository root.
  - [x] Add root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs`, `prettier.config.mjs`, `.env.example`, and `.gitignore`.
  - [x] Add root scripts for `dev`, `dev:mobile`, `dev:api`, `dev:worker`, `typecheck`, `lint`, `test`, and `build`.
- [x] Create Expo native mobile app shell (AC: 1, 2)
  - [x] Create `apps/mobile` with Expo, Expo Router, and TypeScript.
  - [x] Add placeholder tab routes for `Accueil`, `Joueurs`, `Match`, `Vestiaire`, and `Profil`.
  - [x] Add a minimal API health-check client in `apps/mobile/src/api/client.ts`.
- [x] Create NestJS API shell (AC: 1, 2)
  - [x] Create `apps/api` with NestJS and TypeScript.
  - [x] Add `apps/api/src/modules/health` with a `GET /api/v1/health` endpoint.
  - [x] Configure global API prefix `/api/v1`.
- [x] Create shared packages (AC: 1)
  - [x] Create `packages/shared` with API response/error types and first localization placeholders.
  - [x] Create `packages/algorithm` with an exported placeholder module and a passing unit test.
  - [x] Create `packages/config` for shared TypeScript/lint/test configuration.
- [x] Add local infrastructure placeholders (AC: 1)
  - [x] Add `infra/docker-compose.local.yml` with PostgreSQL and Redis service placeholders.
  - [x] Add `docs/runbooks/local-development.md` explaining local setup commands and expected health flow.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm install` succeeds.
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API health endpoint returns a successful response locally.
  - [x] Mobile app can call the health endpoint through the shared API client or a clearly documented local dev URL.

## Dev Notes

This is the first implementation story. There is no previous story intelligence and no existing application code to preserve.

The goal is a clean foundation only. Do not implement authentication, group creation, ratings, team generation, Prisma schema, image generation, or notifications in this story. Add only placeholders needed to make future stories land in the correct locations.

### Current Official Docs To Verify Before Running Commands

- Turborepo official docs show `pnpm dlx create-turbo@latest` and a `--package-manager` option for selecting `pnpm`.
- Expo official docs change SDK template examples over time. Before running `create-expo-app`, verify the current supported template from Expo docs. The architecture captured `default@sdk-56`; if current official docs show a different supported default template, use the current official Expo template and note the deviation in Completion Notes.
- NestJS official CLI docs support creating a project via the managed CLI path, including package-manager selection.
- Prisma is not fully configured in this story; if adding Prisma placeholders, use official `prisma init` behavior later when the first persistence story needs it.

### Architecture Requirements

- Use a pnpm + Turborepo TypeScript monorepo.
- `apps/mobile` is the Expo React Native app with Expo Router.
- `apps/api` is the NestJS API.
- `packages/shared` contains shared API types, constants, localization keys, and common utility types.
- `packages/algorithm` is pure TypeScript and must not import NestJS, Prisma, or mobile code.
- `packages/config` contains shared lint/type/test configuration.
- REST API path prefix is `/api/v1`.
- Backend controllers should remain thin. Business logic belongs in services/packages in future stories.
- Do not introduce web-only UI libraries such as shadcn/ui into the native app.

### Required Initial Structure

```text
apps/
  mobile/
  api/
packages/
  algorithm/
  shared/
  config/
infra/
docs/
```

Recommended near-term target structure is documented in the architecture under Project Structure & Boundaries. This story should create the foundation and the minimal folders required by upcoming stories, not every future file in full detail.

### Health Flow Contract

Backend:

```http
GET /api/v1/health
```

Expected JSON response shape:

```json
{
  "data": {
    "status": "ok"
  }
}
```

Mobile:

- Add an API client function that calls `/api/v1/health`.
- Add a simple visible development-only or placeholder screen state that can prove the mobile app can reach the API.
- Keep the UI plain for now; FiveMatch visual design implementation starts in later app stories.

### Naming And Format Guardrails

- Database and infra naming will use `snake_case` later; API JSON uses `camelCase`.
- API success response wrapper must use `{ "data": ... }`.
- API errors later must use `{ "error": { "code", "message", "details", "requestId" } }`.
- Story 1.1 should establish these shared types in `packages/shared` even if the API only uses the success wrapper initially.

### Testing Requirements

- Add at least one passing unit test in `packages/algorithm` to prove the package test setup works.
- Add at least one API test or simple health endpoint test if the selected NestJS starter makes it practical without adding large test infrastructure.
- Root `pnpm test` must include package tests through Turbo.
- Do not fake a passing script with `echo "no tests"`; the algorithm package must execute a real test.

### Project Structure Notes

- This repository currently stores planning artifacts under `y/_bmad-output`. Implementation code should be created at the project implementation root chosen by the developer, but must not overwrite the BMad planning artifacts.
- If implementation is created under the current workspace root, preserve `y/_bmad-output` and `y/.agents`.
- If a nested `fit-five/` folder is created by `create-turbo`, document that choice and ensure future story paths align with it.
- Prefer one project root for implementation after this story. Avoid a confusing double root where `apps/` exists both at repository root and inside a nested starter folder.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 1.1: Initialize Native App And API Workspace]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Selected Starter Strategy]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- Official Turborepo create-turbo docs: https://turborepo.dev/docs/reference/create-turbo
- Official Expo create-expo-app docs: https://docs.expo.dev/more/create-expo/
- Official NestJS CLI docs: https://docs.nestjs.com/cli/overview
- Official Prisma init docs: https://docs.prisma.io/docs/cli/init

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm install` initially required network escalation because the sandbox blocks npm registry DNS; final install completed with pnpm 10.34.1.
- `expo lint` attempted to write Expo telemetry to `~/.expo`, so the mobile lint script was changed to deterministic `eslint src`.
- Vitest 4 pulled a missing native Rolldown optional binding on this machine; the algorithm package uses Jest instead, matching the Nest test stack.
- `pnpm --filter @fit-five/api test:e2e` requires escalation in this sandbox because Supertest opens an ephemeral local listener.
- Removed the nested generated Expo Git metadata at `apps/mobile/.git` to keep one project root.

### Completion Notes List

- Initialized the FiveMatch implementation workspace at the repository root, preserving all BMad artifacts under `y/_bmad-output`.
- Added Expo native mobile shell with Expo Router tabs for `Accueil`, `Joueurs`, `Match`, `Vestiaire`, and `Profil`.
- Added mobile health-check client that reads `EXPO_PUBLIC_API_BASE_URL` and calls `/health` under the configured `/api/v1` base URL.
- Added NestJS API shell with global `/api/v1` prefix and `GET /api/v1/health` returning `{ "data": { "status": "ok" } }`.
- Added API `dev` alias so root `pnpm dev` can run the API and mobile packages through Turbo.
- Added shared API response/error types and first English/French localization placeholders.
- Added pure TypeScript algorithm package with a real Jest unit test.
- Added local PostgreSQL/Redis compose placeholders and local development runbook.
- Validation passed: `pnpm exec turbo typecheck --force`, `pnpm exec turbo lint --force`, `pnpm exec turbo test --force`, and elevated `pnpm --filter @fit-five/api test:e2e`.

### File List

- `.env.example`
- `.gitignore`
- `docs/runbooks/local-development.md`
- `eslint.config.mjs`
- `infra/docker-compose.local.yml`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `prettier.config.mjs`
- `tsconfig.base.json`
- `turbo.json`
- `apps/api/package.json`
- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/modules/health/health.controller.spec.ts`
- `apps/api/src/modules/health/health.controller.ts`
- `apps/api/src/modules/health/health.module.ts`
- `apps/api/test/app.e2e-spec.ts`
- `apps/api/test/jest-e2e.json`
- `apps/mobile/app.json`
- `apps/mobile/package.json`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/app/_layout.tsx`
- `apps/mobile/src/app/index.tsx`
- `apps/mobile/src/app/joueurs.tsx`
- `apps/mobile/src/app/match.tsx`
- `apps/mobile/src/app/profil.tsx`
- `apps/mobile/src/app/vestiaire.tsx`
- `apps/mobile/src/components/placeholder-screen.tsx`
- `apps/mobile/src/env.d.ts`
- `apps/mobile/src/styles.d.ts`
- `packages/algorithm/package.json`
- `packages/algorithm/src/index.spec.ts`
- `packages/algorithm/src/index.ts`
- `packages/algorithm/tsconfig.json`
- `packages/config/package.json`
- `packages/config/tsconfig/base.json`
- `packages/shared/package.json`
- `packages/shared/src/api/errors.ts`
- `packages/shared/src/api/responses.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/localization/en.ts`
- `packages/shared/src/localization/fr.ts`
- `packages/shared/tsconfig.json`

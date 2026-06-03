---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md
  - _bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/addendum.md
  - _bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/reconcile-brainstorm.md
  - _bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/review-rubric.md
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/mockups/index.html
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/mockups/key-accueil-match.html
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/mockups/key-team-generator.html
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/mockups/key-rating-flow.html
  - _bmad-output/planning-artifacts/ux-designs/ux-fit_five-2026-05-31/mockups/key-card-share.html
workflowType: architecture
project_name: fit_five
user_name: Roro
date: 2026-05-31
lastStep: 8
status: complete
completedAt: 2026-05-31
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Workflow Initialization

The Architecture workflow was initialized from the finalized PRD, PRD addendum, PRD review/reconciliation, UX design contract, UX experience contract, and first-pass key screen mockups.

### Documents Found

- PRD: 1 finalized PRD loaded.
- PRD support documents: 3 support documents loaded.
- UX design: 2 UX specification documents loaded.
- UX mockups: 5 offline mockup references loaded.
- Research: none found.
- Project context: none found.

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

FiveMatch has 30 functional requirements across 11 product domains:

- Authentication and account preferences.
- Groups, invites, membership, and group settings.
- Player identity, football profile, and Vestiaire personality.
- Initial peer ratings and rating progress.
- Match creation, attendance, and waitlist.
- Team generation, regeneration, manual adjustment, and locked teams.
- Match results, goals, assists, MVP voting, and opponent ratings.
- Rating evolution and anti-abuse.
- Leaderboards and player statistics.
- Live player cards, image generation, MVP cards, result posters, and share exports.
- Operational push notifications.

Architecturally, the MVP is not only a CRUD app. It is a native mobile product with a trust-critical backend engine. The team generator, rating evolution, match finalization, image-generation policy, and history integrity need clear domain boundaries so implementation agents do not scatter business rules through screens.

**Non-Functional Requirements:**

The PRD defines 7 NFRs that directly shape architecture:

- Team generation should return within 3 seconds for normal MVP match sizes up to 22 confirmed players.
- Rating, attendance, team confirmation, MVP voting, and result submissions must be idempotent.
- Privacy and account deletion must satisfy App Store and Google Play expectations.
- Uploaded photos and card prompts require automated safety checks before generation.
- French and English localization must cover product UI, push notifications, card text, and share assets.
- Push notifications require consent, preferences, and operational routing.
- Core mobile flows require accessibility-safe labels, touch targets, and status communication beyond color.

**Scale & Complexity:**

- Primary domain: native mobile app plus backend API, PostgreSQL data model, algorithmic team generation, media/image pipeline, notifications, and localization.
- Complexity level: medium-high for MVP because the social UI is simple, but the data, algorithm, moderation, history, and native app distribution concerns are real.
- Estimated architectural components: 11 core components.

The expected MVP scale is private groups of roughly 10-40 players, with individual matches generally using 8-22 confirmed players. This favors a modular monolith or tightly integrated backend first, with strong internal domain boundaries, rather than premature microservices.

### Technical Constraints & Dependencies

Known constraints and dependencies from the PRD/addendum:

- Native app distribution is required for Apple App Store and Google Play.
- React Native + Expo is the preferred mobile direction for MVP unless a later architecture decision rejects it.
- PostgreSQL is required.
- Authentication must support Google, Apple, and email/password.
- Apple Sign In is required on iOS.
- Push notifications are core; Expo Notifications is a recommended MVP path.
- Share export must support native share sheet and PNG.
- Image generation must run server-side, with the app overlaying all trusted text, OVR, stats, QR code, and branding.
- Image uploads, prompts, and generated outputs require moderation/reporting paths.
- The team generator must be explainable enough for users without exposing raw internal weights.
- Formula tuning remains open and should be code-configurable.
- Store readiness requires account deletion, privacy policy, terms, user content reporting, and notification permission handling.

### Cross-Cutting Concerns Identified

- **Domain consistency:** locked teams must be the source of truth for score, stats, MVP votes, opponent ratings, cards, and history.
- **Idempotency:** duplicate taps and retries must not create duplicate ratings, votes, attendance records, score submissions, or generated asset attempts.
- **Authorization:** group owner/admin/organizer/member permissions must be enforced consistently across group settings, match operations, result entry, voiding, and share asset generation.
- **Algorithm trust:** team generation requires deterministic saved versions, fairness calculation, simple explanation, expandable details, and auditability.
- **Rating integrity:** initial ratings are anonymous, one-time, editable only until used, and protected from self-rating, duplicates, and outliers.
- **Historical auditability:** match events, team generation versions, rating history, and voided matches must remain traceable.
- **Media safety:** photo upload, prompt validation, image generation, final asset rendering, reporting, and one-attempt policy must be separate states.
- **Localization:** UI, notifications, card flavor, and share exports must handle French and English from the beginning.
- **Mobile platform behavior:** app links, native share, push permission timing, safe areas, and store compliance need mobile-first design.
- **Performance:** team generation should be fast synchronously for MVP match sizes, while image generation should be asynchronous with clear status.
- **Future readiness:** tournaments, city rankings, public leagues, subscriptions, and venue integrations are deferred but should not be blocked by the initial data model.

### Architectural Implications

The architecture should favor a simple deployable shape with explicit internal modules:

- Mobile app for authenticated user flows, offline-tolerant UI state, native share, push permission, and device-safe presentation.
- Backend API for all trusted business rules and persistence.
- PostgreSQL as the system of record for groups, players, ratings, matches, team versions, stats, cards, notifications, and history.
- Team generator domain module with configurable weights, saved versions, fairness explanation, and simulation hooks.
- Rating engine domain module with baseline rating aggregation, post-match impact, OVR/form evolution, and anti-abuse policies.
- Match lifecycle domain module for attendance, waitlist, lock, score entry, finalization, and voiding.
- Media pipeline for uploads, prompt checks, generation attempts, trusted overlays, final PNG assets, and reports.
- Notification module for operational push events and user preferences.
- Localization module/shared dictionary for app strings, notification templates, and share-asset copy.

The biggest architecture risk is letting the team generator and rating logic become UI-specific code. Those rules should live behind backend domain services with testable pure functions and saved input/output snapshots.

## Starter Template Evaluation

### Primary Technology Domain

FiveMatch is a native mobile app with a backend-heavy domain core.

The primary domain is **mobile app + API/backend**, not a web app. The starter strategy should therefore establish:

- A native iOS/Android app shell.
- A backend API with strong domain boundaries.
- Shared TypeScript contracts where useful.
- PostgreSQL persistence.
- Room for background jobs, notifications, and image generation.

### Current Starter Sources Checked

- [Expo `create-expo-app` documentation](https://docs.expo.dev/more/create-expo/) - current command and templates, including `default@sdk-56`.
- [Expo TypeScript documentation](https://docs.expo.dev/guides/typescript/) - confirms TypeScript-first project creation with Expo.
- [NestJS CLI documentation](https://docs.nestjs.com/cli/overview) - current CLI workflow and `npx @nestjs/cli@latest` option.
- [NestJS CLI usage documentation](https://docs.nestjs.com/cli/usages) - confirms `nest new` options including package manager selection.
- [Turborepo `create-turbo` documentation](https://turborepo.dev/docs/reference/create-turbo) - current monorepo bootstrap command.
- [Prisma ORM quickstart](https://www.prisma.io/docs/prisma-postgres/quickstart/prisma-orm) - current Prisma setup for TypeScript/PostgreSQL.

### Starter Options Considered

**Option A: Expo-only app with backend added later**

- Pros: fastest mobile start; simple for early UI.
- Cons: delays the most important architecture decisions; risks putting rating/team logic in app code.
- Verdict: not recommended for FiveMatch because the algorithm and history model are central, not later add-ons.

**Option B: Next.js/T3-style full-stack starter**

- Pros: excellent for web apps; mature TypeScript patterns; easy API + UI sharing.
- Cons: FiveMatch is explicitly native-store-first, and a web-first starter would pull the architecture toward the wrong product shape.
- Verdict: not recommended as the primary starter.

**Option C: Supabase-first app**

- Pros: fast auth/database/storage setup; useful for small teams.
- Cons: rating evolution, team generation versions, image pipeline, moderation, and notification workflows still need carefully owned domain logic.
- Verdict: viable infrastructure option later, but not the best architecture spine.

**Option D: Flutter app + backend**

- Pros: strong native UI performance and cross-platform app story.
- Cons: splits implementation between Dart and backend language; less aligned with the TypeScript-oriented product/implementation direction already documented.
- Verdict: viable alternative, but not preferred.

**Option E: TypeScript monorepo with Expo mobile app + NestJS API**

- Pros: native mobile fit, shared TypeScript, strong backend module boundaries, good testability for algorithm/rating logic, and clean future separation if services grow.
- Cons: more setup than an Expo-only app; monorepo discipline is required.
- Verdict: recommended MVP foundation.

### Selected Starter Strategy

Use a **pnpm + Turborepo TypeScript monorepo** with:

- `apps/mobile` - Expo React Native app with Expo Router and TypeScript.
- `apps/api` - NestJS API with modular domain structure.
- `packages/shared` - shared TypeScript types, constants, localization keys, API contracts, and pure utility functions.
- `packages/algorithm` - pure team generator, fairness scoring, rating calculations, simulations, and tests.
- `packages/config` - shared lint/type/test configuration.

This gives the product a boring, stable foundation while still protecting the interesting parts: the algorithm and rating engine.

### Initialization Commands

Implementation should verify the final package-manager preference before running commands, but the recommended baseline is:

```bash
pnpm dlx create-turbo@latest fit-five --package-manager pnpm
cd fit-five
pnpm dlx create-expo-app@latest apps/mobile --template default@sdk-56
pnpm dlx @nestjs/cli@latest new apps/api --package-manager pnpm
```

Then add backend persistence:

```bash
cd apps/api
pnpm add @prisma/client @prisma/adapter-pg dotenv
pnpm add -D prisma @types/node
pnpm exec prisma init --output ../generated/prisma
```

### Architectural Decisions Provided By Starter

**Language & Runtime:**

- TypeScript across mobile, API, shared contracts, and pure algorithm modules.
- Node.js backend runtime for NestJS API and background jobs.
- React Native runtime through Expo for iOS and Android.

**Mobile Routing & App Shell:**

- Expo Router file-based routing for native screens.
- Native-safe structure for tabs, deep links, auth gates, and push notification entry points.

**Backend Structure:**

- NestJS modules provide clean homes for auth, groups, players, ratings, matches, team generation, stats, cards, notifications, and moderation.
- Controllers remain thin; business rules live in injectable services and pure domain packages.

**Styling Solution:**

- Use React Native components with a FiveMatch design-token layer derived from `DESIGN.md`.
- Tailwind-style implementation can be added through a native-compatible library later, but the architecture should not depend on web-only shadcn/ui.

**Build Tooling:**

- Turborepo coordinates builds/tests across apps and packages.
- Expo handles native app development and later EAS build/distribution.
- NestJS handles API development/build scripts.

**Testing Framework:**

- Start with unit tests for `packages/algorithm` and backend domain services.
- Add API integration tests around idempotency, authorization, and match lifecycle.
- Add mobile component/e2e coverage after main flows stabilize.

**Code Organization:**

```text
apps/
  mobile/
  api/
packages/
  algorithm/
  shared/
  config/
```

**Development Experience:**

- Shared types reduce drift between app and API.
- Algorithm package can be tested and simulated without running the mobile app.
- API modules can enforce locked-team and rating rules centrally.
- The monorepo remains simple enough for MVP while keeping a clean path to future workers/services.

### First Implementation Story

Project initialization using this starter strategy should be the first implementation story. It should create the monorepo, mobile app, API app, shared packages, lint/typecheck/test scripts, environment templates, and a minimal health check across mobile/API.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Use a TypeScript monorepo with Expo mobile app, NestJS API, shared packages, and pure algorithm package.
- Use PostgreSQL as the system of record with Prisma migrations.
- Use backend-owned domain rules for team generation, ratings, locked teams, match finalization, voiding, and share asset policy.
- Use REST + OpenAPI for app/API communication.
- Use managed native-friendly authentication with backend authorization checks.
- Use server-side asynchronous jobs for image generation, share asset rendering, and push delivery.

**Important Decisions (Shape Architecture):**

- Use TanStack Query for mobile server-state caching and small Zustand stores only for local UI/session state.
- Use Expo Notifications for MVP operational push notifications.
- Use object storage with signed URLs for uploaded photos, generated portraits, and exported share assets.
- Use localized copy dictionaries shared between app, API notifications, and share asset rendering.
- Keep algorithm formulas code-configurable and snapshot-tested.

**Deferred Decisions (Post-MVP or Late MVP):**

- Public web app: deferred because FiveMatch is native-store-first.
- GraphQL/tRPC: deferred because REST + OpenAPI is simpler for native app, future integrations, and backend boundaries.
- Full realtime websockets: deferred; MVP can use push notifications and focused refetching.
- Microservices: deferred; the MVP should start as a modular monolith with separable worker processes.
- Exact AI image provider: deferred behind an image-generation adapter so provider choice can change.
- Payment/subscription infrastructure: deferred because it is out of MVP scope.

### Current Decision Sources Checked

- [Node.js releases](https://nodejs.org/en/about/previous-releases) - use current LTS for backend runtime.
- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/) - use a supported managed PostgreSQL version.
- [Clerk with Expo guide](https://docs.expo.dev/guides/using-clerk/) - native-friendly Expo authentication path.
- [Expo Notifications documentation](https://docs.expo.dev/versions/latest/sdk/notifications/) - MVP push notification path.
- [TanStack Query React Native guide](https://tanstack.com/query/latest/docs/framework/react/react-native) - mobile server-state pattern.
- [BullMQ documentation](https://docs.bullmq.io/) - Node/Redis job queue for async workloads.

### Data Architecture

**Decision: PostgreSQL + Prisma ORM + Prisma Migrate**

PostgreSQL is the system of record for all product history:

- Users and group membership.
- Player profiles and attributes.
- Initial peer ratings and post-match ratings.
- Attendance and waitlist.
- Team generation versions and selected teams.
- Match events, scores, MVP votes, stats, and finalization state.
- Rating history and player statistics.
- Card/image generation attempts and share assets.
- Push tokens and notification records.

**Rationale:**

The app needs relational integrity more than schemaless flexibility. Core behaviors depend on uniqueness constraints, foreign keys, history, snapshots, and idempotent writes.

**Data modeling rules:**

- Every group-scoped record stores `group_id` where applicable.
- Every match-scoped record stores `match_id` where applicable.
- Critical uniqueness belongs in the database, not only application code.
- Store immutable snapshots for team generation inputs/outputs and rating changes.
- Store both current read models and historical event/history records when needed.

**Required database constraints:**

- One initial peer rating per `group_id + rater_player_id + rated_player_id`.
- One post-match rating per `match_id + rater_player_id + rated_player_id`.
- One MVP vote per `match_id + voter_player_id`.
- No self-rating at API/domain validation level.
- One active attendance response per `match_id + player_id`.
- One confirmed locked team version per match.
- One successful free card generation attempt per `group_id + player_id` for MVP policy.

**Caching strategy:**

Start with PostgreSQL-backed read models and TanStack Query app caching. Add Redis caching only for proven hot reads. Redis is required initially for job queues, not for premature data caching.

### Authentication & Security

**Decision: Clerk for native authentication; internal authorization in FiveMatch API**

Use Clerk as the MVP authentication provider for native Expo flows, including Google, Apple, and email/password. The backend stores an internal `users` row mapped to the external auth subject.

**Rationale:**

Native authentication is store-sensitive and easy to underestimate. A managed provider reduces risk around OAuth, Apple Sign In, session refresh, and account lifecycle.

**Authorization pattern:**

- Authentication proves user identity.
- FiveMatch API owns group roles and permissions.
- Backend guards enforce owner/admin/organizer/member authorization.
- Mobile UI can hide unavailable actions, but backend remains the source of truth.

**Security standards:**

- API accepts authenticated requests only for protected endpoints.
- All group data access checks membership.
- Owner/admin-only operations include group settings, membership management, result correction, finalization, and voiding.
- Organizer/admin operations include match creation, team generation, team locking, and score/stat entry.
- Signed upload/download URLs are used for private media.
- Moderation reports and account deletion requests are first-class backend workflows.

### API & Communication Patterns

**Decision: REST API with OpenAPI contract**

Use REST for MVP app/API communication and generate or maintain an OpenAPI contract for typed mobile clients and documentation.

**Rationale:**

REST is straightforward for mobile apps, easy to debug, easy to document, and friendly to future integrations. tRPC is attractive in a TypeScript-only world, but it couples the mobile app too tightly to the backend implementation.

**API domain modules:**

- `auth`
- `groups`
- `players`
- `ratings`
- `matches`
- `attendance`
- `team-generation`
- `match-results`
- `leaderboards`
- `cards`
- `image-generation`
- `share-assets`
- `notifications`
- `moderation`

**API standards:**

- Idempotency keys for operations that may be retried.
- Structured error format with stable machine codes and localized client copy mapping.
- Pagination for roster, match history, leaderboard, and notification endpoints.
- Version path prefix such as `/api/v1`.
- OpenAPI generated during CI.

### Team Generator & Rating Engine

**Decision: pure algorithm package plus backend orchestration**

Team generation and rating evolution live in `packages/algorithm` as pure TypeScript functions. The NestJS API orchestrates data loading, permission checks, persistence, and response formatting.

**Rationale:**

The algorithm is the heart of the app. It must be testable without the app or database, simulated with historical fixtures, and protected from accidental UI drift.

**Team generation pattern:**

1. API validates organizer/admin permission and match readiness.
2. API loads confirmed players, ratings, attributes, form, group settings, and pairing history.
3. API builds a deterministic input snapshot.
4. Algorithm generates candidate splits with seeded controlled randomness.
5. Algorithm returns ranked versions with fairness score and explanation components.
6. API saves the selected generated version and all player assignments.
7. Organizer may regenerate up to 5 versions or use one manual adjustment.
8. Locked version becomes match source of truth.

**Rating evolution pattern:**

1. Initial peer ratings produce baseline OVR/attributes after threshold.
2. Post-match ratings, MVP votes, tags, stats, and result feed rating evolution.
3. OVR moves slowly; form moves faster.
4. Every rating update writes `rating_history`.
5. Suspicious or extreme inputs are softened by policy before final aggregation.

**Testing requirements:**

- Snapshot tests for generated teams and fairness explanations.
- Property tests for constraints such as equal team size, no missing players, no duplicates, and valid goalkeeper handling.
- Simulation fixtures for 5v5, 6v6, 7v7, fixed goalkeeper, rotating goalkeeper, flexible play, and low-rating-data cases.

### Frontend Architecture

**Decision: Expo Router + TanStack Query + small Zustand stores**

The mobile app uses Expo Router for navigation, TanStack Query for server state, and Zustand only for local UI state that does not belong in the backend.

**Rationale:**

Most important FiveMatch state is server-owned: match status, attendance, team versions, locked teams, ratings, stats, cards, and notifications. The app should refetch and invalidate server state rather than maintain a parallel truth.

**Mobile state ownership:**

- Server state: groups, players, matches, attendance, generated teams, ratings, stats, cards, notifications.
- Local state: selected group, temporary form drafts, expanded algorithm details, share export options, unsaved card prompt choices.
- Secure local storage: auth/session tokens handled through provider SDK, plus minimal app preferences where appropriate.

**Design system implementation:**

- Translate `DESIGN.md` into native design tokens.
- Build reusable native components for Match Card, Player Row, Rating Task Card, Team Generation Panel, Locked Teams Panel, Post-Match Action Stack, and Share Asset Picker.
- Avoid web-only dependencies such as shadcn/ui in the native app. If Tailwind-style authoring is desired later, use a React Native-compatible approach, not web Tailwind directly.

### Image Generation & Share Assets

**Decision: asynchronous server-side media pipeline**

Image generation, card rendering, match posters, QR codes, and PNG exports run server-side through a queued pipeline.

**Rationale:**

The app must protect the one-successful-attempt policy, moderate uploads/prompts, keep text accurate, and avoid trusting generated images to render readable numbers.

**Pipeline states:**

- `draft` - user chooses style and prompt.
- `pending_moderation` - image/prompt safety check.
- `blocked` - safety failure, does not consume attempt.
- `queued` - accepted for generation.
- `generating` - provider request in progress.
- `failed_technical` - technical failure, does not consume attempt.
- `generated` - portrait/artwork generated.
- `rendering_asset` - app overlays trusted OVR, stats, branding, QR code, and localized text.
- `ready` - final PNG/share asset available.
- `reported` - user report submitted.
- `hidden` - asset blocked after moderation.

**Storage pattern:**

- Uploaded photos and final assets live in object storage.
- Database stores metadata, state, ownership, prompt/style options, provider references, moderation status, and signed URL references.
- Final text overlays are generated by FiveMatch, never trusted from the AI image layer.

### Notifications & Background Jobs

**Decision: BullMQ + Redis for async jobs; Expo Notifications for push**

Use BullMQ/Redis for queued backend work and Expo Notifications for MVP mobile push delivery.

**Rationale:**

Notifications, card generation, poster rendering, and reminders should not block API requests. Expo Notifications fits the Expo app path and keeps MVP device push handling simpler.

**Job queues:**

- `notifications` - match reminders, waitlist moved-in, teams generated, teams locked, score submitted, MVP vote open, rating reminders, card ready.
- `image-generation` - photo/prompt moderation, AI generation, asset rendering.
- `share-assets` - match poster and MVP card rendering after finalization.
- `rating-evolution` - rating/stat recalculation after match finalization.

**Notification rules:**

- Store Expo push tokens in `push_tokens`.
- Respect user notification preferences.
- Do not request push permission on first launch; request after group join or first match relevance.
- Log attempted/sent/failed notifications for supportability.

### Infrastructure & Deployment

**Decision: modular monolith API plus worker process, provider-agnostic managed infrastructure**

Deploy a NestJS API process and one or more worker processes from the same backend codebase. Use managed PostgreSQL, managed Redis, and object storage.

**Rationale:**

The MVP does not need microservices, but it does need separate web/API and worker runtime concerns.

**Deployment shape:**

- `apps/mobile` builds through Expo/EAS for App Store and Google Play.
- `apps/api` runs as a web API service.
- `apps/api` also exposes worker entrypoints for job queues.
- PostgreSQL is managed.
- Redis is managed.
- Object storage is S3-compatible or provider-native with signed URL support.

**Environment strategy:**

- `local` for developer machines.
- `staging` for app review/test builds and pilot group validation.
- `production` for store release.

**CI minimum gates:**

- Typecheck all packages.
- Lint all packages.
- Unit test `packages/algorithm`.
- Backend API unit/integration tests for idempotency and authorization.
- Prisma schema validation and migration dry-run.
- Mobile build sanity check.

### Decision Impact Analysis

**Implementation Sequence:**

1. Initialize monorepo and app/API packages.
2. Add shared config, shared types, and algorithm package.
3. Configure Prisma/PostgreSQL schema foundation.
4. Add auth integration and internal user mapping.
5. Build group/player/match/rating database modules.
6. Build team generator pure functions and simulation tests.
7. Expose REST endpoints and OpenAPI contract.
8. Build mobile auth/group/match/rating flows.
9. Add job queues, notification module, and image-generation state machine.
10. Add share asset rendering and final post-match flows.

**Cross-Component Dependencies:**

- Team generation depends on player ratings, attributes, attendance, group settings, and pairing history.
- MVP voting and opponent ratings depend on locked teams.
- Stats, leaderboards, rating evolution, and share assets depend on match finalization.
- Card generation depends on player OVR and image moderation.
- Notifications depend on match lifecycle events, user preferences, and push tokens.
- Localization affects app screens, notification templates, and generated share assets.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**

There are 14 areas where implementation agents could otherwise make incompatible choices:

- Database naming.
- API route naming.
- JSON response shape.
- Error shape.
- Date/time handling.
- Authorization checks.
- Idempotency handling.
- Domain event naming.
- Job state transitions.
- Mobile server-state keys.
- Algorithm input/output snapshots.
- Test placement.
- Localization key naming.
- Media asset ownership and URL handling.

### Naming Patterns

**Database Naming Conventions:**

- Tables use plural `snake_case`: `users`, `group_members`, `team_generation_versions`.
- Columns use `snake_case`: `created_at`, `group_id`, `rated_player_id`.
- Primary key column is always `id`.
- Foreign keys use `{entity}_id`: `user_id`, `player_id`, `match_id`.
- Boolean columns use positive names: `is_finalized`, `is_voided`, `is_active`.
- Timestamps use `_at`: `created_at`, `updated_at`, `locked_at`, `finalized_at`.
- Indexes use `idx_{table}_{columns}`: `idx_matches_group_id_date`.
- Unique constraints use `uq_{table}_{columns}`: `uq_mvp_votes_match_id_voter_player_id`.
- Check constraints use `chk_{table}_{rule}`: `chk_matches_team_size_positive`.

**API Naming Conventions:**

- Routes are plural nouns under `/api/v1`: `/api/v1/groups`, `/api/v1/matches`.
- Nested routes use clear parent ownership: `/api/v1/groups/:groupId/players`.
- Route params use camelCase: `:groupId`, `:matchId`, `:playerId`.
- Query params use camelCase: `?period=last5&includeStats=true`.
- Commands use action suffixes only when not naturally CRUD:
  - `POST /api/v1/matches/:matchId/team-generations`
  - `POST /api/v1/team-generations/:versionId/lock`
  - `POST /api/v1/matches/:matchId/finalize`
  - `POST /api/v1/matches/:matchId/void`
- Headers use standard casing:
  - `Authorization`
  - `Idempotency-Key`
  - `Accept-Language`
  - `X-Request-Id`

**Code Naming Conventions:**

- TypeScript variables and functions use `camelCase`.
- TypeScript types, interfaces, classes, and React components use `PascalCase`.
- NestJS files use kebab-case with framework suffix: `team-generation.service.ts`, `ratings.controller.ts`.
- Reusable React Native component files use `PascalCase.tsx`: `MatchCard.tsx`, `PlayerRow.tsx`.
- Expo Router route files follow Expo Router conventions: `index.tsx`, `[matchId].tsx`, `(tabs)/match.tsx`.
- Shared domain functions are verb-first and explicit: `generateTeamVersions`, `calculateFairness`, `evolvePlayerRating`.
- Avoid ambiguous names such as `data`, `item`, `thing`, `calc`, or `helper` in domain code.

### Structure Patterns

**Project Organization:**

```text
apps/
  mobile/
    app/
    src/
      components/
      features/
      lib/
      theme/
  api/
    src/
      modules/
      common/
      jobs/
      prisma/
packages/
  algorithm/
    src/
      team-generation/
      ratings/
      simulations/
      fixtures/
  shared/
    src/
      api/
      constants/
      localization/
      types/
  config/
```

**API Module Pattern:**

Each backend domain module follows:

```text
modules/<domain>/
  <domain>.module.ts
  <domain>.controller.ts
  <domain>.service.ts
  <domain>.repository.ts
  dto/
  policies/
  events/
  __tests__/
```

Controllers validate transport concerns. Services coordinate business use cases. Repositories own persistence. Policies own authorization/domain rules that must be reused.

**Mobile Feature Pattern:**

Each mobile feature follows:

```text
features/<domain>/
  api/
  components/
  hooks/
  screens/
  state/
  types.ts
```

Screens compose feature components. Feature API hooks use the shared API client. Components should not call `fetch` directly.

**Test Placement:**

- Pure algorithm tests live near algorithm source as `*.spec.ts`.
- Backend unit tests live near modules as `*.spec.ts`.
- Backend integration tests live in `apps/api/test/`.
- Mobile component tests live near components as `*.test.tsx`.
- Simulation fixtures live in `packages/algorithm/src/fixtures`.

### Format Patterns

**API Response Formats:**

Successful single-resource response:

```json
{
  "data": {
    "id": "match_123",
    "status": "teams_locked"
  }
}
```

Successful list response:

```json
{
  "data": [],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

Error response:

```json
{
  "error": {
    "code": "MATCH_NOT_READY_FOR_TEAM_GENERATION",
    "message": "This match still needs ratings before teams can be generated.",
    "details": {},
    "requestId": "req_123"
  }
}
```

**Data Exchange Formats:**

- API JSON uses `camelCase`.
- Database uses `snake_case`.
- Dates are ISO-8601 UTC strings in API responses.
- Money/cost fields, if added later, use integer minor units.
- Ratings are numeric 0-100.
- Percentages exposed to users are integer 0-100 unless a specific UI requires decimals.
- Do not expose internal smoothing/confidence values as user-facing fields.

### Communication Patterns

**Domain Event Patterns:**

Domain events use lowercase dot names:

- `match.attendance_updated`
- `match.teams_generated`
- `match.teams_locked`
- `match.score_submitted`
- `match.finalized`
- `match.voided`
- `rating.baseline_completed`
- `rating.evolved`
- `card.generation_queued`
- `card.ready`
- `notification.requested`

Event payloads include:

```json
{
  "eventId": "evt_123",
  "eventName": "match.teams_locked",
  "occurredAt": "2026-05-31T12:00:00.000Z",
  "actorUserId": "user_123",
  "groupId": "group_123",
  "matchId": "match_123",
  "data": {}
}
```

Use an outbox-style table for events that trigger jobs or notifications so successful database writes and async side effects do not drift.

**Job Patterns:**

- Jobs are enqueued from domain events or explicit service methods.
- Jobs must be idempotent.
- Job payloads contain IDs, not full mutable objects.
- Workers reload current state from the database before mutating.
- Jobs write status transitions back to domain tables such as `image_generations`, `share_assets`, or `notifications`.

**Mobile State Patterns:**

TanStack Query keys use array form:

```ts
['groups', groupId]
['groups', groupId, 'players']
['matches', matchId]
['matches', matchId, 'team-generations']
['players', playerId, 'card']
```

Mutations invalidate the smallest useful set of related keys. Avoid global refetches unless the operation changes broad state such as switching the active group.

Zustand stores use `use<Domain>Store` and only hold local UI state:

```ts
useActiveGroupStore
useTeamGeneratorUiStore
useCardDraftStore
```

### Process Patterns

**Idempotency Patterns:**

- Mobile sends `Idempotency-Key` for attendance, ratings, votes, team lock, score submit, finalization, voiding, and image generation request.
- Backend stores processed keys for mutation endpoints where duplicate submission is possible.
- Database uniqueness remains the final protection.

**Validation Patterns:**

- DTO validation handles request shape.
- Domain validation handles business rules.
- Database constraints handle uniqueness/integrity.
- Never rely on mobile UI validation as the only enforcement.

**Error Handling Patterns:**

- Backend logs detailed internal errors with `requestId`.
- API returns stable `error.code` and safe user-facing `message`.
- Mobile maps known `error.code` values to localized copy when needed.
- Blocked states explain the next action, especially rating blocks and team generation blocks.

**Loading State Patterns:**

- Long-running team generation shows active balancing copy.
- Image generation uses async status states, not a blocking spinner.
- Disabled buttons must include or sit next to an explanation.
- Match state screens should always show the latest known status while refetching.

**Algorithm Snapshot Patterns:**

Every saved generated version stores:

- Algorithm version.
- Generator style.
- Group play style.
- Goalkeeper mode.
- Confirmed player IDs.
- Player rating/attribute/form snapshot.
- Pairing history snapshot.
- Candidate score components.
- Fairness percentage.
- Explanation text keys/data.
- Controlled-randomness seed.

This makes team generation auditable and reproducible enough for debugging.

**Localization Patterns:**

- Localization keys use dot notation: `match.attendance.in`, `teamGenerator.blocked.needsRatings`.
- Store copy keys and interpolation data for generated explanations when possible.
- Share assets render with selected export language, not necessarily the user's app language.
- Funny/card names should have separate French and English authored strings when literal translation would be weak.

### Enforcement Guidelines

**All AI Agents MUST:**

- Put competitive business rules in backend domain services or `packages/algorithm`, not in mobile screens.
- Keep locked teams as the source of truth after confirmation.
- Use database constraints for duplicate prevention.
- Use the standard API response and error formats.
- Use idempotency keys for retry-prone mutations.
- Store team-generation snapshots for every generated version.
- Keep Fun/Vestiaire data out of competitive OVR unless a future product decision changes it.
- Keep AI-generated images separate from trusted text/stat overlays.
- Add or update tests when changing algorithm, rating, match lifecycle, or authorization rules.

**Pattern Enforcement:**

- PR/story review checks API shape, naming, idempotency, authorization, and test placement.
- OpenAPI output is generated and checked in CI.
- Prisma migrations are reviewed for naming and uniqueness constraints.
- Algorithm snapshots and simulation tests run in CI.
- Pattern changes must update this architecture document before implementation agents diverge.

### Pattern Examples

**Good Examples:**

- `POST /api/v1/matches/:matchId/team-generations` creates a saved generated version.
- `POST /api/v1/team-generations/:versionId/lock` locks one saved version.
- `uq_initial_peer_ratings_group_id_rater_player_id_rated_player_id` prevents duplicate initial ratings.
- `match.teams_locked` triggers notifications and enables MVP voting after score submission.
- `generateTeamVersions(inputSnapshot)` returns candidates without touching the database.

**Anti-Patterns:**

- Calculating fairness directly inside a React Native screen.
- Letting mobile write player OVR directly.
- Creating duplicate rating rows and deduplicating later in code.
- Storing only final Team A/Team B without the generation input snapshot.
- Rendering OVR or stats inside the AI image prompt instead of overlaying trusted app text.
- Exposing raw smoothing/confidence values to normal users.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
fit-five/
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── eslint.config.mjs
├── prettier.config.mjs
├── .env.example
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── runbooks/
│       ├── local-development.md
│       ├── app-store-release.md
│       └── moderation.md
├── infra/
│   ├── docker-compose.local.yml
│   ├── postgres/
│   └── redis/
├── apps/
│   ├── mobile/
│   │   ├── app.json
│   │   ├── eas.json
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── app/
│   │   │   ├── _layout.tsx
│   │   │   ├── (auth)/
│   │   │   │   ├── sign-in.tsx
│   │   │   │   └── invite.tsx
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   ├── joueurs.tsx
│   │   │   │   ├── match.tsx
│   │   │   │   ├── vestiaire.tsx
│   │   │   │   └── profil.tsx
│   │   │   ├── matches/
│   │   │   │   └── [matchId].tsx
│   │   │   ├── players/
│   │   │   │   └── [playerId].tsx
│   │   │   ├── ratings/
│   │   │   │   └── initial.tsx
│   │   │   ├── cards/
│   │   │   │   └── [playerId].tsx
│   │   │   └── share/
│   │   │       └── [assetId].tsx
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── client.ts
│   │   │   │   ├── errors.ts
│   │   │   │   └── query-keys.ts
│   │   │   ├── components/
│   │   │   │   ├── ui/
│   │   │   │   ├── MatchCard.tsx
│   │   │   │   ├── PlayerRow.tsx
│   │   │   │   ├── RatingTaskCard.tsx
│   │   │   │   ├── TeamGenerationPanel.tsx
│   │   │   │   └── ShareAssetPicker.tsx
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── groups/
│   │   │   │   ├── players/
│   │   │   │   ├── ratings/
│   │   │   │   ├── matches/
│   │   │   │   ├── team-generator/
│   │   │   │   ├── results/
│   │   │   │   ├── leaderboards/
│   │   │   │   ├── cards/
│   │   │   │   ├── notifications/
│   │   │   │   ├── profile/
│   │   │   │   └── vestiaire/
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── share.ts
│   │   │   │   └── storage.ts
│   │   │   ├── theme/
│   │   │   │   ├── tokens.ts
│   │   │   │   └── typography.ts
│   │   │   └── test/
│   │   │       └── render.tsx
│   │   └── assets/
│   │       ├── fonts/
│   │       ├── icons/
│   │       └── images/
│   └── api/
│       ├── package.json
│       ├── nest-cli.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── config/
│       │   │   ├── env.schema.ts
│       │   │   └── configuration.ts
│       │   ├── common/
│       │   │   ├── decorators/
│       │   │   ├── filters/
│       │   │   ├── guards/
│       │   │   ├── interceptors/
│       │   │   ├── pipes/
│       │   │   └── errors/
│       │   ├── prisma/
│       │   │   ├── prisma.module.ts
│       │   │   └── prisma.service.ts
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── groups/
│       │   │   ├── players/
│       │   │   ├── ratings/
│       │   │   ├── matches/
│       │   │   ├── attendance/
│       │   │   ├── team-generation/
│       │   │   ├── match-results/
│       │   │   ├── leaderboards/
│       │   │   ├── cards/
│       │   │   ├── image-generation/
│       │   │   ├── share-assets/
│       │   │   ├── notifications/
│       │   │   ├── moderation/
│       │   │   └── health/
│       │   ├── jobs/
│       │   │   ├── worker.ts
│       │   │   ├── queues.ts
│       │   │   └── processors/
│       │   │       ├── image-generation.processor.ts
│       │   │       ├── notifications.processor.ts
│       │   │       ├── share-assets.processor.ts
│       │   │       └── rating-evolution.processor.ts
│       │   └── generated/
│       │       └── openapi.json
│       └── test/
│           ├── integration/
│           ├── e2e/
│           └── fixtures/
└── packages/
    ├── algorithm/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── team-generation/
    │       │   ├── generate-team-versions.ts
    │       │   ├── score-candidate.ts
    │       │   ├── fairness.ts
    │       │   ├── goalkeeper.ts
    │       │   ├── explanation.ts
    │       │   └── generate-team-versions.spec.ts
    │       ├── ratings/
    │       │   ├── baseline.ts
    │       │   ├── evolve-rating.ts
    │       │   ├── anti-abuse.ts
    │       │   └── evolve-rating.spec.ts
    │       ├── simulations/
    │       │   ├── run-simulation.ts
    │       │   └── scenarios/
    │       └── fixtures/
    │           ├── five-v-five-flexible.json
    │           ├── fixed-goalkeeper.json
    │           └── low-rating-data.json
    ├── shared/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── api/
    │       │   ├── client-types.ts
    │       │   ├── errors.ts
    │       │   └── responses.ts
    │       ├── constants/
    │       │   ├── ratings.ts
    │       │   ├── matches.ts
    │       │   └── cards.ts
    │       ├── events/
    │       │   └── domain-events.ts
    │       ├── localization/
    │       │   ├── en.ts
    │       │   └── fr.ts
    │       └── types/
    │           ├── group.ts
    │           ├── player.ts
    │           ├── match.ts
    │           └── rating.ts
    └── config/
        ├── package.json
        ├── eslint/
        ├── typescript/
        └── test/
```

### Architectural Boundaries

**API Boundaries:**

- Mobile app communicates with backend only through `/api/v1`.
- Mobile app does not write directly to PostgreSQL, Redis, object storage, or job queues.
- Backend controllers are transport boundaries only; domain rules live in services, policies, repositories, or `packages/algorithm`.
- OpenAPI is the contract between mobile and API.

**Component Boundaries:**

- `apps/mobile/app` owns navigation and route composition.
- `apps/mobile/src/features` owns feature-specific screens, hooks, and components.
- `apps/mobile/src/components` owns reusable UI components that are not feature-specific.
- `apps/mobile/src/theme` is generated from or aligned with `DESIGN.md`.
- Feature components may use shared UI components, but shared UI components must not import feature logic.

**Service Boundaries:**

- `apps/api/src/modules/team-generation` orchestrates generation but does not contain scoring math.
- `packages/algorithm` contains scoring math but does not import NestJS, Prisma, or mobile code.
- `apps/api/src/modules/ratings` owns rating persistence and evolution orchestration.
- `apps/api/src/modules/match-results` owns score, events, finalization, and voiding.
- `apps/api/src/jobs` owns async processor entrypoints and calls domain services.

**Data Boundaries:**

- Prisma repositories are the only backend layer that directly queries the database.
- Domain services receive typed domain objects, not raw controller payloads.
- Job payloads contain IDs and reload data from repositories.
- Object storage is accessed through backend media services using signed URLs.
- Algorithm snapshots are persisted by the API, not by `packages/algorithm`.

### Requirements To Structure Mapping

**FR-1 to FR-2: Authentication and language**

- Mobile: `apps/mobile/src/features/auth`, `apps/mobile/app/(auth)`.
- API: `apps/api/src/modules/auth`, `apps/api/src/modules/users`.
- Shared: `packages/shared/src/localization`, `packages/shared/src/api`.

**FR-3 to FR-5: Groups, invites, roles, settings**

- Mobile: `apps/mobile/src/features/groups`.
- API: `apps/api/src/modules/groups`.
- Database: `groups`, `group_settings`, `group_members`, `invitations`.

**FR-6 to FR-8: Player identity, football profile, Vestiaire**

- Mobile: `apps/mobile/src/features/players`, `apps/mobile/src/features/profile`, `apps/mobile/src/features/vestiaire`.
- API: `apps/api/src/modules/players`.
- Database: `players`, `player_attributes`, `player_statistics`.

**FR-9 to FR-11: Initial peer ratings and generation block**

- Mobile: `apps/mobile/src/features/ratings`.
- API: `apps/api/src/modules/ratings`.
- Algorithm: `packages/algorithm/src/ratings`.
- Database: `initial_peer_ratings`, `rating_history`.

**FR-12 to FR-14: Match creation, attendance, waitlist**

- Mobile: `apps/mobile/src/features/matches`.
- API: `apps/api/src/modules/matches`, `apps/api/src/modules/attendance`.
- Database: `matches`, `match_attendance`.

**FR-15 to FR-18: Team generation, regeneration, manual adjustment, lock**

- Mobile: `apps/mobile/src/features/team-generator`, `TeamGenerationPanel.tsx`.
- API: `apps/api/src/modules/team-generation`.
- Algorithm: `packages/algorithm/src/team-generation`.
- Database: `team_generation_versions`, `team_generation_players`.

**FR-19 to FR-22: Score, events, MVP, opponent ratings**

- Mobile: `apps/mobile/src/features/results`, `apps/mobile/src/features/ratings`.
- API: `apps/api/src/modules/match-results`, `apps/api/src/modules/ratings`.
- Database: `match_events`, `mvp_votes`, `post_match_ratings`.

**FR-23 to FR-24: Rating evolution and anti-abuse**

- API: `apps/api/src/modules/ratings`, `apps/api/src/jobs/processors/rating-evolution.processor.ts`.
- Algorithm: `packages/algorithm/src/ratings`.
- Database: `rating_history`.

**FR-25 to FR-26: Leaderboards and statistics**

- Mobile: `apps/mobile/src/features/leaderboards`, `apps/mobile/src/features/players`.
- API: `apps/api/src/modules/leaderboards`, `apps/api/src/modules/players`.
- Database: `player_statistics`.

**FR-27 to FR-29: Cards, image generation, sharing**

- Mobile: `apps/mobile/src/features/cards`, `apps/mobile/app/cards`, `apps/mobile/app/share`.
- API: `apps/api/src/modules/cards`, `apps/api/src/modules/image-generation`, `apps/api/src/modules/share-assets`.
- Jobs: `image-generation.processor.ts`, `share-assets.processor.ts`.
- Database: `player_cards`, `image_generations`, `share_assets`.

**FR-30: Notifications**

- Mobile: `apps/mobile/src/features/notifications`.
- API: `apps/api/src/modules/notifications`.
- Jobs: `notifications.processor.ts`.
- Database: `push_tokens`, `notifications`.

### Integration Points

**Internal Communication:**

- Mobile uses generated or typed REST client functions in `apps/mobile/src/api`.
- API modules communicate by service injection, not HTTP calls.
- Jobs call domain services after loading current database state.
- Domain events flow through an outbox table into BullMQ processors.

**External Integrations:**

- Clerk handles authentication and native sign-in flows.
- Expo Notifications sends push notifications.
- PostgreSQL stores application state and history.
- Redis backs BullMQ queues.
- Object storage holds uploads and generated assets.
- AI image provider is accessed through `apps/api/src/modules/image-generation`.
- Native share sheet is accessed through `apps/mobile/src/lib/share.ts`.

**Data Flow:**

1. User signs in through mobile auth.
2. Backend maps auth subject to internal user.
3. User joins group and creates player profile.
4. Ratings and attendance write to PostgreSQL through API modules.
5. Team generation loads a snapshot and calls `packages/algorithm`.
6. Locked teams drive result entry, MVP voting, opponent ratings, stats, and share assets.
7. Finalization triggers rating evolution, leaderboard updates, notification jobs, and share asset rendering.
8. Share assets are saved in object storage and exposed through signed URLs/native share.

### File Organization Patterns

**Configuration Files:**

- Root config owns workspace, lint, formatting, TypeScript base, and Turbo tasks.
- `apps/mobile/app.json` and `eas.json` own native app configuration.
- `apps/api/src/config` owns runtime configuration validation.
- `.env.example` documents all required environment variables without secrets.

**Source Organization:**

- App screens live in Expo Router `app/`.
- Mobile feature logic lives in `src/features`.
- API business modules live in `src/modules`.
- Cross-cutting backend utilities live in `src/common`.
- Pure algorithm logic lives in `packages/algorithm`.
- Shared constants/types/localization live in `packages/shared`.

**Test Organization:**

- Algorithm unit and property tests are mandatory for every generator/rating formula change.
- API integration tests cover auth guards, idempotency, and match lifecycle.
- Mobile tests focus first on critical cards/components and blocked states.
- E2E coverage should start with create group, rate players, create match, generate teams, finalize match.

**Asset Organization:**

- Static mobile assets live in `apps/mobile/assets`.
- User uploads and generated assets live in object storage, not the repo.
- Share templates live in backend image/share modules because trusted text overlays are server-rendered.

### Development Workflow Integration

**Development Server Structure:**

- `pnpm dev` runs mobile and API development targets through Turbo.
- `pnpm dev:mobile` runs Expo.
- `pnpm dev:api` runs NestJS API.
- `pnpm dev:worker` runs backend workers locally.
- Local PostgreSQL and Redis run through `infra/docker-compose.local.yml`.

**Build Process Structure:**

- Mobile builds through Expo/EAS.
- API builds through NestJS.
- Algorithm/shared packages build before dependent apps.
- OpenAPI output is generated from API build/test flow.

**Deployment Structure:**

- Mobile deploys through App Store and Google Play release channels.
- API deploys as a web service.
- Workers deploy as separate process entrypoints from the API package.
- PostgreSQL, Redis, and object storage are managed services.
- Staging mirrors production integrations where possible.

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**

The architecture decisions work together coherently:

- Expo mobile app aligns with native-store distribution, push notifications, native share, and deep-link invite flows.
- NestJS modular API aligns with the need for backend-owned match, rating, team-generation, authorization, and media rules.
- PostgreSQL + Prisma aligns with the relational history model, idempotency constraints, and audit requirements.
- REST + OpenAPI aligns with mobile/API boundaries and avoids over-coupling the app to backend implementation details.
- BullMQ/Redis aligns with asynchronous image generation, notifications, share asset rendering, and rating evolution.
- `packages/algorithm` isolates the most important business logic from UI and persistence concerns.

**Pattern Consistency:**

The implementation patterns support the core decisions:

- Database `snake_case` and API `camelCase` are explicitly separated.
- API response/error formats are stable.
- Idempotency has API, service, and database-level protections.
- Domain events and job payloads use consistent names and ID-only payloads.
- Mobile server state is owned by TanStack Query, avoiding duplicate truth in local stores.
- Algorithm snapshots make team generation auditable and reproducible.

**Structure Alignment:**

The project structure supports all defined boundaries:

- Mobile routes, feature modules, and reusable components are separated.
- API modules mirror product domains.
- Async jobs live beside backend domain services while remaining separate process entrypoints.
- Shared types/localization/constants live in `packages/shared`.
- Generator and rating math live in `packages/algorithm`.

### Requirements Coverage Validation

**Feature Coverage:**

All major feature groups are architecturally supported:

- Auth and language preferences.
- Groups, roles, invites, and settings.
- Player profile, football identity, and Vestiaire identity.
- Initial peer ratings and post-match ratings.
- Match creation, attendance, and waitlist.
- Team generation, regeneration, manual adjustment, and locking.
- Score, goals, assists, MVP voting, finalization, and voiding.
- Rating evolution, anti-abuse, leaderboards, and statistics.
- Live cards, image generation, match posters, sharing, and moderation.
- Push notifications and notification preferences.

**Functional Requirements Coverage:**

FR-1 through FR-30 are covered by the module map in Project Structure & Boundaries. No functional requirement lacks an implementation home.

**Non-Functional Requirements Coverage:**

- NFR-1 team generation responsiveness is addressed by pure in-process algorithm execution for MVP match sizes, with snapshot tests and possible async fallback later.
- NFR-2 data integrity is addressed through idempotency keys, database uniqueness constraints, and backend-owned source-of-truth rules.
- NFR-3 privacy/account control is addressed through managed auth, internal user mapping, moderation/reporting, and account deletion workflow placement.
- NFR-4 image safety is addressed by the image generation state machine and moderation gates.
- NFR-5 localization is addressed by shared localization packages and export-language support.
- NFR-6 notification consent/control is addressed by Expo Notifications, push token storage, preferences, and delayed permission timing.
- NFR-7 accessibility is addressed by the UX contract and component-level requirements.

### Implementation Readiness Validation

**Decision Completeness:**

Critical decisions are documented: native stack, backend stack, database, API style, auth pattern, job pattern, media pipeline, notification pattern, algorithm boundary, and project structure.

Exact package lockfile versions should be resolved during project initialization, but the current decision sources have been checked and the starter commands use current official install paths.

**Structure Completeness:**

The project tree is complete enough for first implementation stories. It defines root config, mobile app, API app, shared packages, algorithm package, local infra, CI, docs, tests, workers, and generated OpenAPI output.

**Pattern Completeness:**

Potential implementation conflicts are covered across naming, structure, response formats, errors, dates, domain events, jobs, mobile state, algorithm snapshots, idempotency, localization, and enforcement.

### Gap Analysis Results

**Critical Gaps:**

- None.

**Important Gaps:**

- Exact deployment provider is intentionally not selected yet. The structure supports Railway, Render, Fly.io, AWS, GCP, or similar managed infrastructure.
- Exact object storage provider is intentionally not selected yet. The architecture requires signed URL support and can work with S3-compatible or provider-native storage.
- Exact AI image generation provider is intentionally abstracted behind an adapter to preserve cost, quality, and policy flexibility.
- Exact moderation provider/process needs implementation-phase selection before public release.

**Nice-To-Have Gaps:**

- Add sequence diagrams for team generation, match finalization, and card generation.
- Add an ADR folder if the implementation team wants one-decision-per-file traceability.
- Add a load/simulation harness for algorithm tuning after seed data exists.
- Add a formal store-release runbook once Apple/Google developer accounts and release process are chosen.

### Validation Issues Addressed

The main validation concern was avoiding overcommitment to third-party infrastructure too early. The architecture resolves this by locking core boundaries and data ownership while deferring provider choices that do not block the MVP implementation start.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with current source checks
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY WITH MINOR GAPS

**Confidence Level:** high

**Key Strengths:**

- The algorithm is protected as a pure, testable package.
- Locked teams and match finalization are treated as source-of-truth domain concepts.
- Data integrity is enforced at API and database levels.
- Native mobile realities are reflected in auth, notifications, sharing, safe areas, and app-store concerns.
- Image generation is isolated behind safety, state, and overlay rules.
- The project structure gives every FR category a clear implementation home.

**Areas For Future Enhancement:**

- Pick final infrastructure providers after budget and developer account constraints are known.
- Build algorithm simulation tooling before broad beta.
- Add richer observability once pilot groups are active.
- Add ADR files for major post-MVP decisions such as subscriptions, tournaments, and public leagues.

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented.
- Use implementation patterns consistently across all components.
- Respect project structure and boundaries.
- Keep algorithm/rating logic out of the mobile UI.
- Treat this document as the source of truth for technical questions unless it is explicitly updated.

**First Implementation Priority:**

Initialize the TypeScript monorepo with Expo mobile app, NestJS API, shared package, algorithm package, Prisma/PostgreSQL foundation, and a minimal API/mobile health check.

## Completion & Handoff

The Architecture workflow is complete. FiveMatch now has a validated technical blueprint covering product context, starter strategy, core decisions, implementation patterns, project structure, validation, and implementation handoff.

The next planning step is to create epics and stories from the PRD, UX, and architecture so implementation can begin in controlled slices.

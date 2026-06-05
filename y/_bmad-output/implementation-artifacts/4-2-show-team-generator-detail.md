# Story 4.2: Show Team Generator Detail

Status: review

## Story

As an organizer,
I want to review generated teams with clear explanation,
so that I can trust the split before locking it.

## Acceptance Criteria

1. Given a generated version exists, when I view Team Generator Detail, then I see version number, Team A, Team B, totals, fairness percentage, and simple explanation, and I can expand details without seeing raw confusing weights.
2. Given the teams are displayed, when a screen reader reads the screen, then team totals, fairness, and player assignments are accessible.

## Tasks / Subtasks

- [x] Add latest generation read model/API (AC: 1)
  - [x] Add shared nullable response contract for latest saved generation.
  - [x] Add backend endpoint to fetch the latest saved generation for a match.
  - [x] Allow group members to view generated detail while preserving organizer/admin generation permissions.
- [x] Show saved generation detail in mobile Match screen (AC: 1)
  - [x] Rehydrate latest saved generation when the Match screen loads.
  - [x] Display version number, Team A, Team B, totals, fairness percentage, and explanation summary.
  - [x] Add expandable detail panel with friendly algorithm signals instead of raw weights.
- [x] Add accessibility coverage to generated teams (AC: 2)
  - [x] Add accessible fairness label.
  - [x] Add accessible team totals and player assignment labels.
  - [x] Keep detail toggle exposed as an expandable button.
- [x] Verify story quality (AC: 1, 2)
  - [x] Focused API tests succeed.
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 4.1 stores team assignments, totals, fairness, input snapshot, score components, and explanation on the backend.
- The mobile app should not calculate fairness locally; it should display saved generation data from the API.
- Story 4.3 will add multiple versions/regeneration, so Story 4.2 should read the latest saved version without introducing comparison UI yet.

### Architecture Requirements

- The backend remains the source of truth for generation outputs.
- Users in the group can review generated teams; generation itself remains restricted.
- Raw algorithm values such as candidate score, seed internals, and random weights should not be exposed in the mobile detail UI.
- Team totals, fairness percentage, and player assignments must be available to screen readers.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 4.2: Show Team Generator Detail]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#Smart Team Generator]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm --filter @fit-five/api test -- matches.service.spec.ts matches.controller.spec.ts`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm exec turbo build --force`
- `pnpm --filter @fit-five/api test:e2e`

### Completion Notes List

- Added a latest saved team-generation response contract.
- Added an API endpoint for loading the latest saved generation for a match.
- Rehydrated the mobile Match screen with saved generation data.
- Expanded the generated-teams UI with version, team totals, fairness, explanation, and friendly detail rows.
- Added accessibility labels for fairness, team totals, and player assignments.

### File List

- apps/api/src/modules/matches/matches.controller.ts
- apps/api/src/modules/matches/matches.controller.spec.ts
- apps/api/src/modules/matches/matches.service.ts
- apps/api/src/modules/matches/matches.service.spec.ts
- apps/mobile/src/api/client.ts
- apps/mobile/src/app/(tabs)/match.tsx
- packages/shared/src/api/matches.ts
- packages/shared/src/index.ts
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/_bmad-output/implementation-artifacts/4-2-show-team-generator-detail.md
- y/_bmad-output/implementation-artifacts/sprint-status.yaml

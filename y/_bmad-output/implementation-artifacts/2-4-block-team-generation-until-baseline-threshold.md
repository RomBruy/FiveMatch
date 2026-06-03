# Story 2.4: Block Team Generation Until Baseline Threshold

Status: review

## Story

As an organizer,
I want generation blocked until confirmed players have enough ratings,
so that the first generated teams feel credible.

## Acceptance Criteria

1. Given a match has confirmed players below the rating threshold, when an organizer tries to generate teams, then generation is blocked, and the app shows which confirmed players need more ratings.
2. Given generation is blocked, when users view the blocked state, then they can choose Rate Players or Remind Group, and the disabled action includes an explanation rather than a silent failure.

## Tasks / Subtasks

- [x] Add blocked-generation localization (AC: 1, 2)
  - [x] Add French and English gate copy.
  - [x] Add Rate Players and Remind Group action labels.
- [x] Add Match baseline gate UI (AC: 1, 2)
  - [x] Load active group readiness and roster names.
  - [x] Disable Generate Teams while readiness is incomplete.
  - [x] Show missing players and their missing rating counts.
  - [x] Add Rate Players navigation.
  - [x] Add Remind Group sharing text.
- [x] Keep future match-specific architecture clear (AC: 1)
  - [x] Use current group roster as the temporary baseline pool until Epic 3 match attendance exists.
  - [x] Keep copy explicit that confirmed-match gating comes later.
- [x] Verify foundation quality (AC: 1, 2)
  - [x] `pnpm typecheck` succeeds.
  - [x] `pnpm lint` succeeds.
  - [x] `pnpm test` succeeds.
  - [x] API e2e health check still passes.
  - [x] `pnpm build` succeeds.

## Dev Notes

### Previous Story Intelligence

- Story 2.3 added group readiness data with anonymous counts and threshold 3.
- Epic 3 match creation/attendance and Epic 4 team generation do not exist yet.
- For this story, the Match tab can expose the blocking UX against the current group roster as the available baseline pool.

### Architecture Requirements

- Do not create fake match/team-generation persistence before the match and team-generation epics.
- The disabled action must explain why generation is blocked.
- The blocked state should show missing needs and offer Rate Players plus Remind Group.

### References

- [Source: y/_bmad-output/planning-artifacts/epics.md#Story 2.4: Block Team Generation Until Baseline Threshold]
- [Source: y/_bmad-output/planning-artifacts/prds/prd-fit_five-2026-05-31/prd.md#FR-11: Block team generation until baseline threshold is met]
- [Source: y/_bmad-output/planning-artifacts/architecture.md#Team generation pattern]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm exec prettier --write ...`
- `pnpm exec turbo typecheck --force`
- `pnpm exec turbo lint --force`
- `pnpm exec turbo test --force`
- `pnpm exec turbo build --force`
- `pnpm --filter @fit-five/api test:e2e`

### Completion Notes List

- Replaced the Match placeholder with a baseline generation gate screen.
- Loaded active group readiness and roster names to show which players still need ratings.
- Disabled Generate Teams while readiness is incomplete and showed a clear blocked explanation.
- Added Rate Players navigation to the Joueurs tab and Remind Group sharing text.
- Added French and English generation-gate copy.
- Kept the screen explicit that it uses the current group roster until real match attendance exists.

### File List

- apps/mobile/src/app/(tabs)/match.tsx
- packages/shared/src/localization/en.ts
- packages/shared/src/localization/fr.ts
- y/\_bmad-output/implementation-artifacts/2-4-block-team-generation-until-baseline-threshold.md
- y/\_bmad-output/implementation-artifacts/sprint-status.yaml

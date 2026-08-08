# Implementation Roadmap

Status: Phase 0 complete; approved Phase 1 scope implemented and verified locally
Last reviewed: 2026-08-06

## 1. Delivery rules

For every phase:

1. Name requirement IDs.
2. List affected files/modules.
3. Record existing behaviour.
4. Choose the smallest safe design.
5. Document schema and migration impact.
6. Add tests first where practical.
7. Implement without unrelated product changes.
8. Run static, unit, mobile, and isolated integration gates.
9. Report results and known limitations.
10. Update the audit completion status and traceability matrix.
11. For each affected screen, record the existing design pattern reused, change type (layout, styling, or behavior), requirement, and visual/accessibility verification.

Do not modify OVR mathematics or pronostic arithmetic. Do not run destructive migrations against existing development or production data. Preserve the existing design system under PR-055; no functional phase authorizes an unrelated redesign.

## 2. Phase 0 — Documentation and safety baseline

Requirements: PR-011, PR-012, PR-039, PR-052, PR-054 and test foundations for all requirements.

### Deliverables

- Maintain the eight audit/design documents introduced by Step 1.
- Add golden OVR regression fixtures without changing production OVR code.
- Preserve and characterize current pronostic calculation outputs.
- Add explicit API contract schemas/tests for current match/player responses as a baseline.
- Add recursive forbidden-field privacy assertions.
- Add isolated PostgreSQL integration infrastructure using guarded `TEST_DATABASE_URL`.
- Rename or reconfigure orphaned integration tests so every intended test executes.
- Add a minimal mobile test command and first navigation/serializer rendering tests after dependency review.
- Inventory existing design tokens, shared UI primitives, navigation, animation, responsive, and accessibility patterns as the reference for later screen changes.
- Add a Phase 0 guard/report that identifies newly added visual dependencies and requires explicit justification.
- Produce read-only reports for:
  - duplicate/global player identities;
  - actual completed participant counts versus `players.matchCount`;
  - potential card eligibility;
  - rating duplicates/ineligible shapes;
  - migration `0015` collisions and soft-deleted duplicates.

Implemented Phase 0 report command: `AUDIT_DATABASE_URL=... pnpm --filter @fivematch/api audit:phase0`. It runs inside a database-enforced read-only transaction and writes only JSON to standard output. No backfill or migration is authorized by the report.

### Expected files/modules

- `apps/api/vitest.config.ts`
- `apps/api/vitest.integration.config.ts`
- new test database setup under `apps/api/src/tests/`
- OVR tests under `apps/api/src/services/players/__tests__/`
- pronostic tests under `apps/api/src/services/pronos/`
- API contract tests and shared schemas under `packages/` or API schema modules
- mobile package scripts/test configuration only after choosing the smallest compatible setup
- documentation and report scripts that are read-only by default

### Migration impact

None. Phase 0 may inspect and report but must not mutate existing data.

### Exit criteria

- Golden OVR and existing pronostic calculation tests pass.
- Critical integration files are demonstrably included by a test command.
- Integration startup refuses a non-test database.
- Baseline API response contracts are captured.
- Read-only migration/card/count reports are reviewed.
- All project checks pass.
- PR-055 is represented in test/report templates and no Phase 0 visual dependency or screen change is introduced.

Phase 0 record for PR-055: `docs/design-system-inventory.md` captures the current code baseline. This phase changes no screen layout, styling, interaction or navigation. The package-level guard reuses Node and the existing mobile toolchain, so no dependency or visual deviation is introduced.

### Phase 0 verification record — 2026-08-02

- OVR/pronostic golden and contract/guard tests: 21/21 passed in targeted execution.
- Full root test command: 34 API files/299 tests passed; mobile baseline/typecheck/parity passed.
- Isolated PostgreSQL migrations: passed against the separately named, tmpfs-backed `fivematch_test` container.
- Isolated integration command: 8 files/37 tests passed; one TODO-only file was collected with 3 TODOs.
- Root typecheck and lint: passed; lint retains one pre-existing generated Expo Router warning.
- Read-only audit command: smoke-tested successfully against the disposable database; an explicitly selected project-data `AUDIT_DATABASE_URL` is still required to produce the real migration/count review artifact.
- Disposable container and network were removed after verification. No development or production data was read or changed.

No project-data migration or historical backfill is approved. The approved Phase 1 work proceeds only for additive schema and deterministic future-write behavior in the isolated local database; applying migration `0016` to any existing environment remains blocked on the read-only preflight and explicit review.

### Rollback

Tests, scripts, and docs only. Remove test infrastructure/config additions if necessary; no application data is changed.

## 3. Phase 1 — Critical data integrity

Requirements: PR-001/002, PR-011 through PR-017, PR-026 through PR-031, PR-045, PR-054 and PR-055 within the explicitly approved Phase 1 scope.

### Implemented locally

- Added `player_match_eligibilities` as the unique future canonical source and retained `players.match_count` as a synchronized compatibility cache with drift reporting.
- Made result completion a conditional one-winner transition; removed match counting from OVR processing.
- Added atomic `ovr_processing_events` claims and match-linked unique `rating_events`.
- Enforced completed valid result, open window, final snapshot, non-self and opposing-team checks on the server plus rating uniqueness.
- Corrected the existing mobile post-match component to receive opponents using existing tokens/primitives and no new dependency.
- Disabled new initial crew ratings, preserved historical rows/OVR and removed the blocking join redirect.
- Changed ordinary crew removal to end membership only; global identity and historical participation/statistics/ratings/pronostics remain.
- Corrected CI integration setup to use guarded `TEST_DATABASE_URL` against only the CI PostgreSQL service.

The previously listed organizer-transfer and destructive global-player migration concerns remain independently tracked; they were not expanded into this explicitly bounded Phase 1 request.

### Migration impact

Migration `0016_phase1_integrity.sql` is additive: two tables, one nullable audit column, foreign keys, lookup indexes and three uniqueness boundaries. It was applied only to disposable PostgreSQL. No historical backfill, merge, delete or OVR rewrite exists. `docs/phase1-migration-plan.md` and the read-only SQL preflight define conflicts, forward fix and rollback limitations.

### Local exit evidence — 2026-08-06

- API typecheck and lint pass.
- API unit/route suite: 37 files, 310 tests passed.
- Isolated PostgreSQL suite: 9 files / 47 active tests passed; one collected legacy file retains 3 explicit GDPR TODOs. Phase 1 concurrency and migration-integrity fixtures are green.
- Mobile opponent tests, TypeScript, i18n parity and PR-055 design baseline pass; lint has only the pre-existing generated Expo Router warning.
- OVR v2.3 golden constants/outputs and pronostic golden calculations/1,000 balance pass unchanged.
- No existing development, staging or production database was contacted. No deployment or real-data reconciliation occurred.

### Remaining limitation

Final attendance, no-show and void evidence does not yet exist. Phase 1 uses versioned final-participant snapshot evidence and must not claim attended status. Phase 3 must strengthen the rule. Applying `0016` outside a disposable database remains blocked on real-data preflight/approval.

## 4. Phase 2 — Privacy and permissions

Status: Implementation complete in the isolated local environment on 2026-08-06; final unrestricted API/integration exit-check rerun pending. No deployment or real-data migration approved.

Requirements: PR-008, PR-018/019, PR-040 through PR-043, PR-051/052.

### Deliverables

- Separate private owner and public player DTOs/serializers.
- Add field-level visibility with private defaults.
- Add minimum-sample privacy rules for aggregates.
- Split public match, participant, crew, and host attendance responses.
- Remove pending/waitlist/private crew data from unrelated public responses.
- Introduce explicit capability evaluation and endpoint guards.
- Add explicit `canSubmitProno` without changing calculations.
- Remove rater/reporter leakage from all response/log/notification paths.

### Migration impact

Add visibility fields/table with conservative defaults. Produce a populated-field migration report before applying.

### Exit criteria

- Public/private contract tests and forbidden-key assertions pass.
- Every sensitive route names and tests its capability.
- Public match data contains no private crew administration.

### Local completion record

- Shared strict schemas live in `@fivematch/types`; mobile consumes profile, preview, match-detail and attendance contracts.
- Explicit capabilities derive from host identity, active group role, confirmed non-waitlisted RSVP, final participant evidence, visibility and match state.
- Migration `0017` adds the all-private visibility object and constraint; its read-only preflight reports counts only.
- Deterministic fixtures cover owner, former/shared/multiple groups, participant, host/organizer, waitlist, out, unknown, outsider, per-field audiences and aggregate thresholds.
- Profile, public preview, match detail, attendance, group and card-status boundaries are server shaped; mobile does not receive hidden values.
- PR-055 remains intact: four tabs, 13 baseline primitives and 52 direct dependencies; no design/navigation dependency changed.
- Static/shared/mobile checks pass. The final restricted API run collected 41 files / 319 tests: 217 non-socket tests passed and 102 Supertest cases were blocked before assertions by local `listen EPERM`; the final expanded Phase 2 PostgreSQL file also awaits an unrestricted rerun. See `docs/phase2-completion-report.md`.
- Phase 3 remains separate and is not authorized by this completion record.

## 5. Phase 3 — Attendance, reliability, and fair play

Requirements: PR-013/014, PR-020 through PR-025.

### Deliverables

- Separate RSVP from final attendance.
- Add attended, excused absence, and no-show outcomes.
- Store late arrival separately.
- Store cancellation time and distinguish late cancellation.
- Add behaviour reports, dispute status, validators, and audit timestamps.
- Add conflict resolution for host/co-host/moderator cases.
- Build reliability/fair-play projections from finalized records only.
- Expose safe owner/public aggregates and histories.

### Dependencies

All previously blocking decisions are resolved and normative: ADR-018 (host plays by default), ADR-019 (reliability/fair-play formulas and exposure), ADR-020 (no OVR before the first eligible match), ADR-027 (dispute authority), ADR-028 (12-hour cancellation deadline).

### Work packages

| # | Package | Contents |
|---|---|---|
| 3A | Attendance model | `attendance_outcome` enum; `outcome`, `cancelledAt`, `arrivedLate`, `finalizedAt`, `finalizedBy` on `match_attendances`; `cancellation_deadline_hours` on `groups`; finalization service |
| 3B | Behaviour reports | `behaviour_reports` table (match, reporter, subject, category, detail, status, validator, timestamps); corroboration and expiry workflow per ADR-027 |
| 3C | Trust projections | `trust-constants.ts`; reliability and fair-play services; safe aggregates; `trust-signal-isolation` test |
| 3D | Capabilities | `canReportAttendance`, `canManageAttendance`, `canResolveDispute`; `co_host` role; host added to `canSubmitProno` |
| 3E | Mobile trust surfaces | Owner detail and history in Profil; host finalization UI; report flow; public check mark |
| 3F | Pronos tab | `GET /v1/players/me/pronos`; fifth dock tab; design baseline raised to five tabs |

### 3A local completion record — 2026-08-07

Implemented on the isolated local database only. No deployment, no real-data migration, no backfill.

- `attendance_outcome` enum plus `outcome`, `cancelled_at`, `arrived_late`, `finalized_at`, `finalized_by` on `match_attendances`; `cancellation_deadline_hours` on `groups` with a 0–168 check constraint.
- `packages/types/src/trust-constants.ts` created with its own `TRUST_CONSTANTS_VERSION`, holding `DEFAULT_CANCELLATION_DEADLINE_HOURS = 12`. No OVR constant was touched and `ALGORITHM_CONSTANTS_VERSION` is unchanged.
- `attendance-finalization.service.ts` exposes a pure total `classifyOutcome` and a transactional `finalizeMatch`. Classification depends only on stored facts and never on the wall clock, so history stays recomputable if the deadline is retuned.
- `attendance.service.ts` now records `cancelledAt` whenever a confirmed seat is released and clears it when the player returns. It records the fact only; lateness is decided at finalization.
- Idempotency is structural: already-finalized rows are never re-read, so a replay settles nothing twice. Rows that earn no outcome are still stamped, otherwise every replay would reconsider them.
- Migration `0018_phase3_attendance_outcomes` is fully additive — one enum, six columns, one foreign key, one index, one check. It contains no DROP, DELETE or UPDATE, and applies cleanly to the disposable `fivematch_test` database.
- Gates: API typecheck, lint, 42 files / 329 unit tests, and 11 files / 59 isolated PostgreSQL integration tests all pass. Mobile typecheck, lint, 638/638 i18n parity and the 4-tab design baseline are unaffected and still pass. The OVR and pronostic golden regressions pass unchanged.

Not yet built: no route, no mobile surface, and no projection consumes these outcomes. Reliability still reads the legacy `commitmentCount`/`noShowCount` counters via `attendanceService.reliabilityOf` until 3C replaces it.

### 3B local completion record — 2026-08-07

Implemented on the isolated local database only. No deployment, no real-data migration, no backfill.

- `behaviour_reports` table with `behaviour_report_category` (four negative, two positive) and `behaviour_report_status` (`pending`, `finalized`, `dismissed`, `expired`). `co_host` added to `member_role`.
- Corroboration requires two independent reporters agreeing on the same match, subject **and** category. Differing categories are not agreement. A database unique constraint on (match, reporter, subject, category) prevents one person manufacturing their own corroboration, and a check constraint rejects self-reports at the storage layer.
- Positive categories finalize on submission. Requiring two witnesses before a compliment counts would suppress praise, and the +10 cap in ADR-019 bounds any gaming.
- Resolution authority is impartial by construction: never the reporter, never the subject, and crew organizer or co-host only. Authority never overrides impartiality — an organizer who is the subject still cannot resolve their own report. A standalone match has no validator at all and relies on corroboration or expiry.
- Pending reports expire after `BEHAVIOUR_REPORT_WINDOW_HOURS` (72) and are then permanently inert; a late validator cannot revive one. Resolution and expiry are both idempotent via a `status = 'pending'` guard.
- GDPR: reports **about** a purged user are hard-deleted; reports **by** them survive with `reporterPlayerId` and `detail` nulled, so erasing one person never silently rewrites another's record. A detached row stops counting toward corroboration. `validatorPlayerId` is detached likewise.
- Migration `0019_phase3_behaviour_reports` is fully additive — two enums, one enum value, one table, two constraints, two indexes. No DROP, DELETE or UPDATE of existing rows.
- Gates: types and API typecheck, API lint, 42 files / 329 unit tests, and 12 files / 77 isolated PostgreSQL integration tests all pass. Mobile is untouched and still passes. OVR and pronostic golden regressions unchanged.

Not yet built: no route and no mobile surface. Nothing consumes finalized reports until 3C builds the fair-play projection. `expireStaleReports` exists but no scheduler calls it — 3D or a later operational pass must wire it.

### 3C local completion record — 2026-08-07

Implemented on the isolated local database only. No migration was needed; 3C is projection and contract work.

- `services/trust/trust-projection.service.ts` computes reliability and fair play from finalized records only. `computeReliability`, `computeFairPlay`, `earnsReliableCheck` and `recencyWeight` are pure and total; the window is truncated by the caller so nothing reads a clock.
- Reliability: 20-match window, exponential decay at a 10-match half-life, weights per ADR-019, first two excused absences free. The allowance is spent newest-first and refreshes as records age out, so no counter is stored.
- Fair play: starts at 100, severity-weighted finalized negatives subtract, positives add and are capped at +10, clamped 0–100. Pending, dismissed and expired reports contribute nothing.
- **`trust-signal-isolation.test.ts` enforces ADR-019 structurally.** It reads every OVR calculation source and fails if any references a trust constant, module or identifier; it fails if a trust module imports an OVR module; it asserts the two constant modules carry independent versions; and it pins the OVR breakdown shape as having no attendance or behaviour input. If a listed OVR source is renamed the test fails rather than silently passing.
- Exposure now matches ADR-019 end to end. `PublicPlayerProfileSchema.reliability` is **removed** and replaced with `isReliable: boolean`. The raw scores moved to owner-only `PrivatePlayerProfileSchema.trust`. Two further public leaks were found and closed: `PublicMatchPreview.host.reliability` and the participant-sheet `reliability` field, both now the boolean mark. A contract test asserts the public schema rejects `reliability`, `fairPlay` and `trust`.
- The legacy `reliabilityOf` helper is deleted. It read RSVP intent rather than finalized outcomes, could not distinguish an excused absence from a no-show, and had no recency — one bad month followed a player forever.
- Participant sheets use `getReliableFlags`, which resolves a whole roster in one query rather than per player. Fair play is deliberately not computed there: nothing public consumes it, so fetching it would gather sensitive data for no purpose.
- Mobile: `TrustRow` renders an earned check with a tap-to-explain label instead of a percentage, and its `unreliable` style is gone. Profile shows the owner their own number from the owner-only block. i18n at 639 keys per locale.
- Gates: types and API typecheck, API lint, 44 files / 355 unit tests, 12 files / 81 isolated PostgreSQL integration tests. Mobile typecheck, lint, 639/639 parity and the 4-tab baseline pass. OVR and pronostic golden regressions unchanged.

Not yet built: no route exposes fair play to its owner, no report or finalization UI exists, and `expireStaleReports` still has no scheduler. Those are 3D and 3E.

### 3D local completion record — 2026-08-08

Implemented on the isolated local database only. No migration was needed; 3D is authorization and wiring.

- `canReportAttendance` requires the final participant snapshot on a completed match — precisely what `behaviourReportService` enforces. A confirmed seat alone is not evidence you were present to see anything.
- `canResolveDispute` is crew organizer or co-host. It means "may act as validator on this match"; per-report impartiality — never the reporter, never the subject — stays in the service, because capabilities are per match and cannot see a report. A standalone match yields false for everyone, the host included.
- `canManageAttendance` now includes co-host through the shared manager predicate.
- `canSubmitProno` gained the host, closing the gap ADR-018 identified: a non-playing host of a standalone match was neither participant nor crew member and could not bet on their own match.
- **Latent break from 3B closed.** Adding `co_host` to `member_role` left thirteen hand-written `['member', 'organizer']` filters that silently excluded co-hosts from the capability resolver, seeded attendance, crew rosters, notifications, tier counting and profile visibility. All now use a single `ACTIVE_CREW_ROLES` constant exported from the schema, whose comment records why an inline allowlist is the wrong shape here. Two raw-SQL filters in `player-profile.service.ts` became `<> 'pending_member'`, matching the pattern `ovr.service.ts` already used correctly.
- `runBehaviourReportExpiryJob` is registered hourly alongside the existing card-state-timeout job. It settles records rather than deciding anything: `expiresAt` already makes an unswept report inert on every read path, so running it late or twice changes nothing.
- Schema mocks in thirteen route/service test files needed `ACTIVE_CREW_ROLES` added. Vitest throws on a missing mock export, which surfaces as an opaque 500 rather than a module error — the same trap recorded for `players` earlier in the project.
- Gates: types and API typecheck, API lint, 44 files / 360 unit tests, 12 files / 81 isolated PostgreSQL integration tests. Mobile typecheck, lint, 639/639 parity and the 4-tab baseline pass. OVR and pronostic golden regressions unchanged.

Not yet built: no route consumes the new capabilities and no mobile surface exposes reporting, finalization or dispute resolution. That is 3E.

### 3E local completion record — 2026-08-08

Implemented on the isolated local database only. No migration was needed.

Routes, all behind `loadMatch` plus a capability guard:

- `POST /:matchId/finalize-attendance` — host settles the sheet. Idempotent; replaying only picks up rows still unsettled.
- `POST /:matchId/reports` — submit a behaviour report. The response carries only the caller's own report state.
- `GET /:matchId/reports/pending` — validator queue.
- `POST /:matchId/reports/:reportId/resolve` — validator decision. The capability establishes authority on the match; the service still applies per-report impartiality, because only it knows who the report concerns.

Design decisions worth keeping:

- **The host is asked only who arrived late.** Attended, excused, late cancellation and no-show are all derived server-side from the RSVP sheet, the cancellation timestamp and the final participant snapshot. Asking a host to re-enter what the system already knows invites both error and score-shopping. Lateness is the one fact only the host witnessed.
- **Reporter identity never reaches the validator queue.** A validator judges the account, not its author, and is often in the same crew as both parties. The account text still reaches them or there is nothing to judge.
- **Reports the validator is party to are filtered from their own queue**, not merely refused on write, so an unresolvable report never appears as actionable work.
- **Corroboration state is never observable.** The reporter's confirmation says only that the report was received. A visible count would tell a reporter exactly how many more voices are needed.
- **Finalization state is one manager-only boolean.** Per-player outcomes on the sheet would tell a whole roster who no-showed — the visible negative ADR-019 refuses. The host needs to know the job is done, not who let them down.

Mobile: `AttendanceFinalization` and `ReportPlayerSheet` on the match screen, `TrustDetail` in Profil showing the owner their own reliability and fair play — the only screen in the app where fair play appears. Report categories list praise first so the flow does not read as a complaints box. i18n at 662 keys per locale.

Gates: types and API typecheck, API lint, 44 files / 360 unit tests, 12 files / 83 isolated PostgreSQL integration tests. Mobile typecheck, lint, 662/662 parity and the 4-tab baseline pass. OVR and pronostic golden regressions unchanged.

Outstanding: no Expo Go device pass has been run on any Phase 3 screen. Route-level HTTP tests are not written — the services beneath them are covered by integration tests, but the middleware wiring itself is only exercised by typecheck.

### 3F local completion record — 2026-08-08

Implemented on the isolated local database only. No migration was needed.

- `GET /v1/players/me/pronos` returns the whole tab in one call: balance, every market the caller may bet on now, and their bet history. Market-open uses the same `teams_generated && scheduledAt > now` proxy as the odds route's own `ODDS_NOT_AVAILABLE` precondition, so a card never opens onto a 422. Eligibility mirrors `canSubmitProno` — participant, crew member or host — evaluated in one query rather than per match.
- Betting itself stays on the match-scoped routes that price the odds. This endpoint is an index, not a second betting surface.
- Fifth dock tab at `pronos/index`; `pronos/[matchId]` stays `href: null` so the betting board keeps no slot of its own. Dock geometry needed no change: five 48px tabs occupy 240 of 340px.
- `design-baseline.json` raised to five tabs. The `_layout.tsx` comment explaining the four-tab decision was rewritten rather than left contradicting the code.
- i18n at 671 keys per locale.

### Phase 3 exit record — 2026-08-08

All six packages implemented locally. Gates across the whole phase:

- Types, API and mobile typecheck; API and mobile lint.
- **45 files / 371 API unit tests**, including 12 route-level authorization tests added for the Phase 3 endpoints.
- **12 files / 83 isolated PostgreSQL integration tests.**
- Mobile 671/671 i18n parity, PR-055 baseline at 13 primitives / 5 tabs / 52 dependencies, `expo export --platform ios` succeeds.
- OVR and pronostic golden regressions unchanged throughout. `trust-signal-isolation` passes.

Migrations `0018` and `0019` are additive only and have been applied solely to the disposable `fivematch_test` database. No real-data migration, backfill or deployment is approved by this record.

**Outstanding for Phase 3:** no Expo Go device pass has been run on any Phase 3 screen — finalization, reporting, owner trust detail and the Pronos tab are verified by types, lint, tests and a successful export, but none has been seen running on a phone. `RELIABLE_CHECK_MIN_SCORE = 85` was chosen during 3C rather than specified in ADR-019 and is worth confirming against real data.

### Counter policy

`players.commitment_count` and `no_show_count` are a cache, never the source of truth. Both derive from finalized records and carry a `reconcile()` rebuild, following the audited pattern already used by `bankroll.service.ts`. Duplicated counters without a canonical source are prohibited.

### Migration impact

Migration `0018` is fully additive: two enums, five columns, one table. No destructive statement.

Existing RSVP values cannot reliably backfill final attendance. `outcome` stays nullable, reliability counts finalized records only, and every pre-Phase-3 match contributes nothing to either projection. Unknown historical outcomes remain unknown rather than guessed.

## 6. Phase 4 — Card eligibility

Requirements: PR-026 through PR-031.

### Deliverables

- Add unique `(player, match)` card eligibility ledger.
- Create eligibility only after valid result and finalized attended outcome.
- Unlock exactly at four active eligible records.
- Add correction/invalidation events.
- Backfill only source-provable eligible matches.
- Preserve historical OVR values.

### Dependencies

Both resolved. Phase 3 finalized attendance exists; ADR-017 (never re-lock) and ADR-029 (automatic finalization) are accepted.

### Local completion record — 2026-08-08

Implemented on the isolated local database only. No deployment, no real-data migration, no backfill.

- **The evidence bar moved.** Eligibility now requires a finalized `attended` outcome *and* presence in the final participant snapshot. Phase 1 could only prove the snapshot, which meant a no-show named on a team sheet counted toward a card (PR-030). New rows carry `evidence_version = 'phase4_finalized_attendance_v1'`; Phase 1 rows keep theirs, because a row created from a team sheet cannot be retroactively claimed as proof of attendance.
- **Eligibility moved off result-recording onto finalization**, which is the first moment the evidence exists. The card-unlock notification moved with it — leaving it on the route would have silently dropped every unlock the automatic sweep settled.
- **Automatic finalization (ADR-029)** sweeps hourly against a 48-hour grace period. Without it, card progress would hang on whether a host remembered to confirm the sheet. A host who finalizes late finds nothing left to settle, so the manual and automatic paths cannot disagree.
- **Voiding** strikes a completed match from card counting via `voided_at`/`voided_by`/`void_reason` on matches, cascading to `invalidated_at`/`invalidation_reason`/`invalidated_by` on the ledger. Idempotent: a second void never rewrites the original reason or actor. `POST /:matchId/void` is manager-only and returns a count, not names — naming affected players would hand a host a list of people to explain an administrative correction to.
- **Cards never re-lock (ADR-017).** Eligibility count and card state legitimately disagree after a void: the ledger is the audit truth, `card_state` is a high-water mark. Progress below the threshold still walks back for a card not yet unlocked, because nothing has been given yet.
- **Historical OVR is never recomputed** on void, asserted directly rather than assumed.

Migration `0020` is fully additive — four columns, two foreign keys, one index. No DROP, DELETE or UPDATE.

**No backfill was performed, and the exit criterion asking a backfill report to reconcile every created row is therefore satisfied vacuously.** Existing eligibility rows were created under Phase 1 evidence and cannot be upgraded: no finalized outcome exists for any historical match, and inventing one would be exactly the guess Phase 1 refused to make.

Gates: types and API typecheck, API lint, 45 files / 371 unit tests, 13 files / 99 isolated PostgreSQL integration tests including the full 16-case card matrix. Mobile typecheck, lint, 671/671 parity and the 5-tab baseline pass. OVR and pronostic golden regressions unchanged.

Not yet built: no mobile surface for voiding a match, and no owner-facing explanation of why a card did not progress.

### Exit criteria

- Complete card test matrix passes.
- Before/after OVR validation is identical.
- Backfill report reconciles every created eligibility row.

## 7. Phase 5 — Panini photo lifecycle

Requirements: PR-032 through PR-037 and photo visibility in PR-041.

### Deliverables

- Move controls to global Profile.
- Separate raw source and generated output.
- Complete owner upload/generation flow.
- Add versioned consent, current-consent checks, withdrawal, and display visibility.
- Add owner-only status and deletion.
- Add byte/type/dimension/download/redirect controls.
- Moderate input and generated output.
- Delete storage objects during owner deletion/GDPR purge.
- Move processing and deletion to durable retryable jobs.

### Migration impact

Add consent records and object metadata. Existing consent boolean requires a conservative migration: treat it as non-current until the user accepts the versioned policy.

## 8. Phase 6 — Match and crew usability

Requirements: PR-003, PR-005 through PR-009, PR-044 through PR-049.

### Deliverables

- Guest/privacy-safe discovery and authentication return intent.
- Cached/manual location and contextual push permission.
- Next match and Needs attention sections.
- Progressive match creation and repeat/default shortcuts.
- Explicit host participation choice.
- Crew-first opening time and actual remaining-place publication.
- Edit, cancel, external waitlist, manual promotion, invitations, and directions.
- Merge duplicate legacy group detail into Crew.
- Keep secondary engagement below match operations.

Every screen change in this phase must reuse documented existing components/tokens and include before/after supported-size and accessibility verification. The phase changes functional hierarchy and missing states only where required; it is not a visual redesign.

### Migration impact

Potential publication/opening, invitation, organizer, venue preference, and cancellation fields. Additive migrations preferred.

## 9. Phase 7 — Scalability and operational reliability

Requirements: PR-010, PR-050 through PR-054.

### Deliverables

- Transaction-safe join/waitlist/cancellation/promotion.
- Database-level discovery joinability and capacity filtering.
- Stable cursor pagination and exact radius filtering.
- Discovery repository and relevant indexes.
- Durable job/outbox worker for reminders, recurring matches, rating closure, notification retries, and storage deletion.
- Delivery receipts/token cleanup/deduplication.
- Split oversized match/group route files by domain.
- Consolidate match detail/attendance query paths.
- Add query-count, latency, and city-scale load tests.

### Exit criteria

- Zero over-capacity results under concurrency stress.
- Discovery p95 meets product target at representative load.
- Jobs survive replay/restart without duplicate effects.
- Public/mobile contracts share the canonical schema.

## 10. Phase 8 — Production infrastructure, ownership and European compliance

Requirements: PR-054, PR-055 and the production launch obligations documented in this phase.

Status: **Not started. Deployment is not approved.** Phase 8 planning documents are not evidence that an environment, control, contract, backup, or compliance process exists.

### Entry gate

Phase 8 begins only after all of the following are evidenced and explicitly approved:

- all approved functionality is complete locally;
- local unit, contract and integration tests pass;
- every database migration passes against disposable PostgreSQL;
- synthetic audit fixtures pass;
- critical mobile flows pass manual supported-size and accessibility checks;
- PR-055 design-system preservation remains satisfied;
- no unresolved P0 or P1 blocker remains.

Until that approval, development, databases and tests remain local and isolated. Do not buy, provision, migrate, restore, connect, or deploy production/staging infrastructure merely because this phase is documented.

### Objective

Move the completed local application to owner-controlled, understandable, documented, recoverable and secure infrastructure in an approved European location, compatible with GDPR and Swiss data-protection obligations.

### Workstreams and required evidence

1. Complete `docs/infrastructure-ownership.md` for source control, hosting, PostgreSQL, backups, object storage, authentication, email, push, analytics, monitoring, AI/image processing, domain/DNS and app-store accounts. The app owner controls critical billing, recovery and administrator access; no developer, contractor or coding tool is sole owner.
2. Accept an architecture decision comparing a European self-hosted API/PostgreSQL stack with an API plus managed PostgreSQL. PostgreSQL remains the database unless a separately approved decision says otherwise.
3. Verify the actual country/region and transfer path for database, backups, images, authentication, analytics, error monitoring, push and AI processors. A provider's company address is not region evidence.
4. Establish independent local, automated-test, staging and production databases, credentials, secrets, API URLs and storage buckets. Production data/credentials never enter local or automated-test environments; staging uses synthetic or approved anonymized data only.
5. Create least-privilege application, migration, read-only administrator and emergency administrator roles. PostgreSQL remains private behind an SSH tunnel, VPN, private network or provider-controlled secure connection.
6. Complete and test `docs/runbooks/database-access.md`, including a supported visual PostgreSQL workflow, environment identification, access granting/revocation and safe aggregate inspection.
7. Keep `docs/database-schema.md` synchronized with migrations, including relationships, keys, constraints, indexes, retention and ownership boundaries.
8. Complete `docs/runbooks/backup-and-restore.md`; implement encrypted off-server backups, failure alerts, retention, object-storage recovery and a successful full staging restore. A generated backup without restore evidence is not valid.
9. Activate owner-controlled monitoring and alerts for CPU, memory, disk, PostgreSQL health/connections/slow queries, jobs, backups, API errors/latency, crashes, storage, notifications and certificate expiry.
10. Complete the production security baseline: patched OS, restricted key-only SSH where possible, firewall, private PostgreSQL, TLS, secret rotation, least privilege, container/dependency scanning and incident response.
11. Complete privacy notice, terms, retention, access/correction/deletion and breach processes, processor register, record of processing, analytics notice where applicable, and photo consent/deletion evidence. Professional GDPR and Swiss data-protection review remains a launch prerequisite.
12. Review every processor's data, location, retention, DPA, subprocessors, deletion and international-transfer mechanism. Optional photo transformation remains disabled until all relevant processors and lifecycle controls are approved.
13. Complete `docs/runbooks/deployment.md`; production migrations require human review, preflight, backup, a separate migration role, reconciliation and recorded results. No unreviewed automatic production migration is permitted.
14. Rehearse the full stack in staging using synthetic or approved anonymized data, including migrations, journeys, backup/restore, access, deletion, failed deployment, database outage, failed job and rollback/forward-fix procedures.
15. Complete `docs/infrastructure-costs.md` with verified current pricing, free-tier limits, actual spend, 1,000/10,000-active-user scenarios, billing alerts and responsible billing owner.
16. Complete owner handover for access, billing, recovery, deployment, backups, incident contacts, secret rotation, diagrams, costs, processors, data export and deletion.

### Required deliverables

Before requesting production launch approval, return:

1. Infrastructure architecture diagram.
2. Verified database and storage locations.
3. Completed ownership register.
4. Environment matrix.
5. Accepted hosting decision and rationale.
6. Tested database-access runbook.
7. Current database relationship diagram.
8. Backup and restore evidence.
9. Monitoring and alert inventory.
10. Completed security checklist.
11. Processor register.
12. Privacy and retention checklist.
13. Tested deployment runbook.
14. Staging rehearsal results.
15. Monthly cost register.
16. Owner handover checklist.
17. Final launch recommendation.
18. Remaining risks.

### Production launch gate

Production launch is forbidden until owner control, approved European regions, environment separation, private database access, operational backups, a successful restore, monitoring, staging migration evidence, critical test evidence, verified deletion, processor/privacy documentation, closed security blockers, costs and owner handover are all complete.

### Design-system impact

PR-055 remains mandatory. Phase 8 is infrastructure work and authorizes no redesign. Any necessary infrastructure error or maintenance state reuses existing components, tokens, layout, navigation, responsive and accessibility patterns; its minimal deviation and visual evidence must be recorded before implementation.

### Phase 8 planning documents

- `docs/infrastructure-ownership.md`
- `docs/infrastructure-costs.md`
- `docs/database-schema.md`
- `docs/runbooks/database-access.md`
- `docs/runbooks/backup-and-restore.md`
- `docs/runbooks/deployment.md`

## 11. Unresolved decisions blocking later phases

1. Minimum playable size when attendance is locked below nominal capacity.
2. Card re-lock behavior after later invalidation.
3. Public visibility of participant names and exact venue before joining.
4. Generated-photo default audience and retention duration after consent withdrawal.
5. Phase 8 hosting model: self-hosted PostgreSQL/API or managed PostgreSQL with API hosting.
6. Verified European regions, international transfers and processor agreements for every production service.
7. Approved backup RPO/RTO, retention and responsible owner.
8. Production/staging account ownership, billing, recovery and administrator assignments.

Resolved on 2026-08-07 and now normative: initial OVR seeding (ADR-020), host participation (ADR-018), reliability and fair-play formulas plus their exposure model (ADR-019), dispute authority (ADR-027), cancellation deadline (ADR-028). Public minimum sample for aggregate attributes remains ADR-026; fair play is never published at all.

Decisions must be recorded in `docs/architecture-decisions.md` before the affected implementation starts.

## 12. Progress reporting

The defect register in `docs/audit-findings.md` is the source of completion status. A phase is not complete until:

- associated defects are marked complete with evidence;
- traceability test links point to executed tests;
- required commands pass;
- migrations have rehearsed recovery evidence;
- docs describe the implemented behavior rather than only the proposal.

Phase 8 additionally requires dated evidence for every launch-gate item. Empty templates, repository configuration, invoices, successful backup creation without restore, or an unreviewed legal checklist do not count as operational proof.

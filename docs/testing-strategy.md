# Testing Strategy

Status: Phase 2 privacy boundary implemented locally; existing-environment migration pending
Last reviewed: 2026-08-06

## 1. Goals

Tests protect product invariants, privacy, authorization, mathematical stability, and data migrations. Passing TypeScript compilation is not evidence that an API contract, database race, mobile journey, or migration is safe.

No destructive migration or integration setup may target existing development or production data.

## 2. Current verified state

- Root `pnpm typecheck` passes after the Phase 0 additions.
- Root `pnpm lint` passes apart from the existing generated Expo Router unused-disable warning.
- English/French key parity reports 620 keys in each locale, but does not detect incorrect-language or stale semantic values.
- Root `pnpm test` passes: 34 API files/299 tests plus the mobile Phase 0 test command.
- The mobile test command typechecks, verifies translation parity and enforces the PR-055 design baseline without adding a dependency.
- `apps/api/vitest.config.ts` excludes `src/tests/integration/**`.
- `apps/api/vitest.integration.config.ts` now includes every `src/tests/integration/**/*.test.ts`, installs the guarded test URL first and serializes files.
- The isolated PostgreSQL run passed 8 files/37 tests; one TODO-only file was collected with 3 TODOs. The two formerly orphaned files were included.
- The migration wrapper applied the full repository migration journal successfully to the tmpfs-backed `fivematch_test` database. No existing application database was used.
- Existing OVR function tests are valuable but do not cover end-to-end rating authorization, event uniqueness, or the double match-count trigger.
- Existing pronostic arithmetic tests are valuable and must remain unchanged.

## 3. Test layers

### Static and contract checks

- TypeScript strict compilation.
- ESLint and i18n parity.
- Shared Zod/OpenAPI-style DTO compatibility checks.
- No forbidden fields in public/private serializers.
- Migration/schema drift checks.

### Unit tests

Use for pure calculations and policy functions:

- Existing OVR math and golden fixtures.
- Pronostic odds, payout, refund, and ledger arithmetic.
- Capability matrices.
- Reliability/fair-play projection from finalized events.
- Card eligibility policy.
- Public/private serializers.
- Geographic cursor encoding and joinability predicates.

### API route tests

Use mocked persistence only for response-envelope and validation behavior. Authorization and uniqueness that depend on database state must also have integration coverage.

### PostgreSQL integration tests

Use real constraints and transactions for:

- global player uniqueness;
- multiple crew memberships;
- rating uniqueness;
- rating eligibility joins;
- join/waitlist/promotion concurrency;
- OVR/card event uniqueness;
- outbox deduplication;
- migration rehearsal and backfill validation;
- GDPR object-deletion orchestration with storage fakes.

### Mobile component/navigation tests

Add the smallest suitable React Native test setup when Phase 0 is approved. Cover:

- first-run discovery states;
- deep-link authentication continuation;
- next-match and attention sections;
- join/waitlist primary actions;
- public/private profile rendering;
- rating opponent list;
- card-photo consent lifecycle;
- accessible labels and disabled/error states.

For PR-055, each screen-change test plan also names the reused design primitive and classifies the change as behavior-only, layout, or styling. Where the current setup supports it, capture screenshot or render-snapshot comparisons at supported compact and large sizes. Tests must verify existing accessibility roles, labels, touch targets, reduced-motion behavior, and theme behavior are preserved or improved.

### End-to-end journeys

Use an Expo-compatible E2E tool only after evaluating existing dependencies and CI. Critical journeys are solo join, crew host/publish, cancellation/promotion, and privacy-safe shared match.

### Design-system preservation — PR-055

- Record a baseline inventory of existing tokens and shared primitives before screen implementation.
- Assert feature work imports existing tokens/components instead of introducing hardcoded colors, typography, spacing, or radii where a token exists.
- Review dependency diffs so no visual/component library is added without explicit justification.
- Compare affected screens at supported small and large widths.
- Preserve navigation structure unless another documented requirement explicitly requires a minimal route change.
- Preserve or improve accessibility labels, roles, focus/reading order, touch targets, reduced motion, and existing theme behavior.
- Store before/after screenshots or snapshots when supported by the selected mobile test tooling.
- Treat an undocumented visual deviation as a failed acceptance criterion even if functional tests pass.

Phase 0 implementation: `apps/mobile/scripts/check-design-baseline.mjs` verifies the recorded direct-dependency set, required shared design files and four-tab navigation baseline. It deliberately uses built-in Node APIs and adds no visual or test dependency. The baseline inventory and screen-change record live in `docs/design-system-inventory.md`.

## 4. Isolated database design

Phase 0 must add a test database harness before any integration migration work.

Required guardrails:

1. Integration command requires `TEST_DATABASE_URL`; it does not fall back to `DATABASE_URL`.
2. Startup rejects a database whose name does not contain an approved test suffix/prefix.
3. Startup rejects known production/development database names.
4. Tests use a disposable database or isolated schema created for the run.
5. Migrations run only inside that disposable target.
6. Cleanup verifies the exact target before dropping it.
7. CI provisions PostgreSQL independently.
8. Test workers are serialized or isolated where cross-test transactions would conflict.

Do not solve network/sandbox failures by pointing tests at an existing application database.

### Phase 0 isolated PostgreSQL workflow

The repository now provides an ephemeral PostgreSQL 16 service in `docker-compose.test.yml`. Its data directory is a `tmpfs`, its database is named `fivematch_test`, and it does not share the development or production volumes.

Use the explicit URL only for the guarded commands:

```sh
docker compose -f docker-compose.test.yml up -d postgres-test
TEST_DATABASE_URL=postgresql://fivematch_test:fivematch_test@127.0.0.1:55432/fivematch_test pnpm --filter @fivematch/api db:migrate:test
TEST_DATABASE_URL=postgresql://fivematch_test:fivematch_test@127.0.0.1:55432/fivematch_test pnpm --filter @fivematch/api test:integration
docker compose -f docker-compose.test.yml down
```

`setup-test-database.ts` runs before integration modules import `db/index.ts`. It requires `TEST_DATABASE_URL`, rejects non-PostgreSQL URLs, rejects known application database names, requires an explicit test marker in the database name, rejects equality with `DATABASE_URL`, and only then assigns the guarded value to the process-local `DATABASE_URL`. Integration files are serialized and the include pattern now covers both `.integration.test.ts` and the previously orphaned `.test.ts` files in the integration directory.

### Phase 0 read-only data report

Run `AUDIT_DATABASE_URL=... pnpm --filter @fivematch/api audit:phase0` only with an explicitly supplied target. The script never falls back to the application `DATABASE_URL`, enables PostgreSQL's read-only default, opens a repeatable-read read-only transaction, applies a statement timeout, emits JSON to standard output and rolls back. It reports global-player duplicates (including soft-deleted collisions), stored-versus-observed completed participation counts, provisional card candidates, duplicate/suspicious rating shapes and migration-0015 merge collisions.

The report intentionally cannot approve a card backfill: the current schema cannot prove final attendance or a voided-match state. Its opaque identifiers make it a restricted review artifact even though it contains no names or emails.

### Phase 1 executed verification — 2026-08-06

The approved implementation was rehearsed only against the tmpfs-backed local PostgreSQL service with `DATABASE_URL` explicitly unset and `TEST_DATABASE_URL` set to the named `fivematch_test` database.

- `pnpm --filter @fivematch/api typecheck`: passed.
- `pnpm --filter @fivematch/api lint`: passed.
- `pnpm --filter @fivematch/api test`: 37 files / 310 tests passed.
- guarded migration through `0016_phase1_integrity`: passed.
- `pnpm --filter @fivematch/api test:integration`: 9 files / 47 active tests passed; 1 collected legacy file contains 3 explicit TODOs. Coverage includes canonical/repeated result evidence, count/card uniqueness, concurrent ratings and OVR closure, exclusions, preserved group history and the preflight conflict fixture.
- `pnpm --filter @fivematch/mobile test`: 3 opponent/error-state units passed; PR-055 baseline, 620/620 i18n parity and TypeScript passed.
- mobile/API lint: no errors; one pre-existing warning remains in generated `.expo/types/router.d.ts`.

Phase 1 snapshot-only tests are temporary: final participant presence is not proof of attendance. Phase 3 must extend/replace them with attended, excused, no-show, late-arrival, dispute, correction and void cases. No test infers a final outcome from RSVP.

Migration conflict coverage uses stable synthetic UUIDs and `example.invalid` identities. A temporary unconstrained table classifies deliberate duplicate ratings, while live-table concurrent tests prove the final unique constraints and deterministic conflict response. The real-data preflight is read-only and must run before any existing-environment migration.

### Phase 2 executed verification — 2026-08-06

Phase 2 was implemented and rehearsed only in the same disposable tmpfs-backed `fivematch_test` PostgreSQL service. The additive migration through `0017_phase2_privacy_boundaries` and its read-only preflight passed there; the empty synthetic target reported zero affected/invalid rows. No existing development, staging or production database was contacted.

- API and shared-types TypeScript and ESLint checks passed.
- Mobile: 3 opponent/error-state units passed; 638/638 i18n parity, 13-primitives/4-tabs/52-dependencies PR-055 baseline and TypeScript passed. ESLint has no errors and retains the one pre-existing generated Expo Router warning.
- The last unrestricted API run before the final owner-only card tests passed 40 files / 317 tests. The current restricted runner collected 41 files / 319 tests: all 217 non-socket tests passed, including OVR/pronostic golden, capability, serializer and recursive contract suites; 102 Supertest route cases could not bind an ephemeral local socket and stopped before assertions with `listen EPERM`.
- The Phase 2 PostgreSQL privacy integration file previously passed its six deterministic audience/threshold cases. Its final expanded form (anonymous preview, multiple-group relation and sanitized owner-history additions) could not be rerun because local-socket/database execution permission was unavailable after the runner allowance was exhausted.

The last two bullets are an operational verification limitation, not a passing claim. Before Phase 2 is promoted or Phase 3 relies on this baseline, rerun the exact commands below in an environment that permits local loopback sockets:

```sh
pnpm --filter @fivematch/api test
TEST_DATABASE_URL=postgresql://fivematch_test:fivematch_test@127.0.0.1:55432/fivematch_test pnpm --filter @fivematch/api test:integration
```

Phase 2 tests cover separate owner/public profile schemas, independent field visibility, relationship loss, non-participant attendance states, public/group/participant/manager match and attendance variants, minimum-sample rating aggregates, owner-only card status and recursive forbidden fields. They do not infer final attendance or implement fair-play/reporting policy.

## 5. OVR regression suite — PR-011 through PR-019

Before changing OVR inputs/triggers, add golden fixtures that freeze:

- algorithm constants version and values;
- attribute weights and calibration anchors;
- EMA results at representative match counts, rater counts, agreement, and crew tiers;
- goal/assist/MVP/outcome contributions;
- clamp and trend behavior;
- initial seeding outputs for representative inputs;
- full breakdown output for fixed fixtures.

Then add integration tests:

- same valid inputs yield the same OVR before and after trigger fixes;
- one completed match increments the canonical completed count once;
- one match creates at most one OVR event per player;
- repeated rating-window closure is idempotent;
- ineligible rating rows never enter OVR processing;
- reliability, fair play, and pronostic data are absent from OVR inputs;
- repairing card eligibility does not update historical OVR columns/events.

## 6. Rating suite — PR-015 through PR-019

Test the complete matrix:

- rater absent from match;
- rater waitlisted;
- rater confirmed but finalized non-attendee;
- target absent from match;
- target non-attendee;
- target on same team;
- target on opposing team;
- self-rating;
- cancelled match;
- voided match;
- incomplete result;
- closed window;
- allowed completed opponent rating;
- sequential duplicate;
- concurrent duplicate, with database constraint proving one row;
- initial/pre-match rating route disabled or no longer affecting OVR according to ADR-020.

## 7. Privacy suite — PR-008, PR-018/019, PR-040 through PR-043

- Private owner DTO contains allowed aggregates and visibility controls only.
- Public player DTO contains only allowed public fields.
- A field defaulted private is absent for public, participant, and crew audiences unless explicitly changed.
- No response, notification, log fixture, leaderboard, match payload, or export contains rater/reporter IDs or raw scores.
- Public attributes are withheld below the approved privacy sample threshold.
- Public match response excludes pending/declined/unknown crew rows, waitlist identities, private notes, source, and internal administration.
- Host response retains only the internal data its capabilities permit.
- Arbitrary authenticated users cannot access owner-only photo status or consent.

Use schema snapshots plus explicit forbidden-key recursive assertions; snapshots alone can normalize accidental sensitive fields.

## 8. Attendance, reliability, and fair-play suite — PR-020 through PR-025

- RSVP confirmed/cancelled/declined/waitlisted transitions.
- Final attended, excused absence, and no-show outcomes.
- Late arrival stored independently.
- Late cancellation does not become no-show automatically.
- Pending/disputed events do not change aggregates.
- Finalized events update aggregates once.
- Repeated finalization is idempotent.
- Reversal/correction updates projection once and retains audit evidence.
- Host conflict routes to co-host/moderator.
- Reporter identity is absent from subject-facing response.
- Multi-crew activity updates one global reliability/fair-play projection without attributing it to the wrong crew.

## 9. Card suite — PR-026 through PR-031

- Zero through three active eligibility records remain locked.
- Exactly four unlock.
- Two rated matches do not unlock through duplicated counters.
- Same match/player cannot count twice under concurrency.
- Cancellation, no-show, excused absence, unused waitlist, incomplete result, and voided match do not count.
- Attended completed match with valid result counts once.
- Card state is global across multiple crews.
- Backfill report does not mutate data.
- Approved backfill creates only records justified by source rows.
- Historical OVR values/events are byte-for-byte unchanged by card repair.
- Administrative invalidation follows ADR-017 once decided.

## 10. Photo suite — PR-032 through PR-037

- Owner-only consent, status, generation, withdrawal, and deletion.
- Policy version, purpose, retention, visibility, and timestamps recorded.
- Generation rejected without current consent.
- Consent withdrawn between enqueue and processing rejects processing.
- MIME signature, byte, pixel, timeout, response-size, and redirect/host checks.
- Missing face and flagged input.
- Flagged generated output.
- Processor and upload failures.
- Idempotent generation and quota under concurrency.
- Generated object access respects visibility.
- Owner deletion removes storage object and database reference.
- GDPR purge retries object deletion and records completion.

External processors and B2 use deterministic test doubles; no real user image is sent during tests.

## 11. Pronostic suite — PR-038 and PR-039

Keep current calculation cases and add:

- starting bankroll exactly 1,000;
- confirmed standalone participant allowed;
- active associated-crew member not playing allowed;
- unrelated public viewer denied;
- waitlisted player denied unless independently crew-eligible;
- out or unknown player denied unless independently crew-eligible;
- non-playing standalone host denied;
- removed crew member denied;
- settlement replay never double-credits;
- authorization changes leave odds, stake, payout, refund, and reconciliation fixtures identical.

## 12. Match concurrency and discovery suite — PR-006 through PR-010

- Twenty concurrent claims for one seat yield one confirmation and controlled remaining outcomes.
- Duplicate same-player join returns existing state.
- Concurrent waitlist assignment yields unique deterministic order.
- Concurrent cancellations/promotions fill each free seat once.
- Cancelled/locked/completed/expired/private matches reject public joins.
- Discovery and joinability contract agree for every state.
- Full filtering occurs before pagination limit.
- Cursor traversal has no duplicate/omitted stable rows for unchanged data.
- Exact radius excludes bounding-box corners.

## 13. Migration verification

For each destructive or backfill migration:

1. Restore a sanitized representative dump into the isolated database.
2. Capture pre-migration counts, duplicates, and referential coverage.
3. Produce a dry-run/report mode where required.
4. Take a test backup.
5. Run migration once and validate.
6. Run the migration/rehearsal again where idempotency is claimed.
7. Compare player identities, ratings, attendance, participants, cards, bankroll ledgers, and crews.
8. Exercise the application against migrated data.
9. Restore backup or execute tested rollback/forward fix.

Migration `0015_match_first_pivot.sql` is specifically blocked from production until this process passes.

## 14. Phase 8 staging and production-readiness verification

Phase 8 does not begin until all functional phases, local checks, disposable migrations, synthetic audit fixtures and critical mobile flows pass with no P0/P1 blocker. Its documentation templates are not test evidence.

Required staging evidence includes:

- independent staging database, credentials, secrets, storage and API URL in the approved region;
- synthetic or approved anonymized representative data only;
- every migration plus reconciliation, idempotency and rollback/forward-fix rehearsal;
- full API, worker and critical mobile journey smoke tests;
- successful encrypted backup and full isolated restore with measured RPO/RTO;
- application, migration, read-only and emergency role permission tests;
- proof PostgreSQL is not publicly reachable and production inspection is database-enforced read-only;
- account export/deletion and processor/object deletion tests;
- photo consent/processing/deletion tests if and only if the optional feature is approved; otherwise proof it remains disabled;
- outage simulations for PostgreSQL, failed deployment and failed/replayed job;
- delivery of CPU, memory, disk, PostgreSQL, job, backup, API, crash, storage, notification and TLS alerts to owner-controlled destinations;
- dependency/container security scans and secret-leak checks;
- PR-055 supported-size, accessibility and visual-consistency evidence for any infrastructure-related UI state.

Production launch additionally requires completed ownership, region/transfer, processor/privacy, cost and owner-handover records. No test command may use production credentials or data.

## 15. Phase completion command gate

Every implementation phase reports:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @fivematch/api test:integration
<mobile test command once added>
```

No phase is complete with a failing required test, an excluded critical test, or an integration run pointed at a non-disposable database.

No UI-bearing phase is complete without its PR-055 implementation record and visual/accessibility verification.

Phase 8 requires the normal command gate plus dated staging rehearsal, restore, monitoring, access-revocation, security/privacy and owner-approval evidence. A successful deploy command alone is not a pass.

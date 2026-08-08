# Deployment Runbook

Status: Phase 8 draft; no staging or production deployment approved
Last reviewed: 2026-08-06

This runbook becomes executable only after Phase 8 entry criteria, ADR-022, infrastructure ownership, European region/processor review, staging rehearsal and an explicit owner approval are complete. Repository deployment workflows are not authorization to deploy.

No paid infrastructure may be bought or provisioned from this document alone. No automatic or application-startup production migration is allowed.

## 1. Required roles

| Role | Responsibility |
|---|---|
| Release owner | Approves scope, target, timing, user impact and final go/no-go |
| Deployment operator | Executes reviewed application/worker/mobile steps |
| Migration operator | Uses the separate migration role for approved migration only |
| Database reviewer | Reviews preflight/reconciliation and backup/restore readiness |
| Security/privacy reviewer | Confirms secrets, processors, deletion/privacy and transfer impacts |
| Incident lead | Owns stop/rollback/forward-fix decision and communications |

One person may hold multiple roles only when owner-approved, but production actions must remain reviewable and attributable.

## 2. Release record

Complete before execution:

| Field | Value |
|---|---|
| Change/release ID | TBD |
| Target environment | TBD; must be stated verbally and in the record |
| Application version/commit | TBD |
| Mobile version/build | TBD |
| Migration IDs | TBD / none |
| Current deployed version | TBD |
| Backup/checksum/time | TBD |
| Approved maintenance window | TBD |
| Operators/reviewers | TBD |
| Rollback/forward-fix decision | TBD |
| User communication | TBD |
| Explicit owner approval | Not granted |

## 3. Pre-deployment gate

- [ ] All local typecheck, lint, unit, contract and isolated integration tests pass.
- [ ] Synthetic audit fixtures and applicable read-only migration preflight pass.
- [ ] Critical mobile flows pass supported-size, accessibility and PR-055 checks.
- [ ] No unresolved P0/P1 blocker exists.
- [ ] Correct target environment, region, database, storage and roles are independently verified.
- [ ] Staging and production credentials/resources are separate.
- [ ] Infrastructure ownership, billing and recovery are owner-controlled.
- [ ] Processor/privacy/security approvals cover this release.
- [ ] Optional photo processing remains disabled unless its entire approval gate is complete.
- [ ] Current application version and configuration are recorded.
- [ ] A current backup exists and the restore process has prior successful evidence.
- [ ] Migration SQL, locks, runtime, backfill, idempotency, rollback/forward-fix and reconciliation are reviewed.
- [ ] Monitoring dashboards and owner-controlled alerts are healthy.
- [ ] Incident lead and stop conditions are acknowledged.

## 4. Deployment sequence

Execute and timestamp each step:

1. Confirm all tests and review gates pass.
2. Confirm the exact target environment using safe host/port/database/region metadata.
3. Create and verify the required database backup without exposing data or credentials.
4. Record the current application, worker, schema/migration and mobile versions.
5. Review every migration and verify that no unreviewed migration can run automatically.
6. Run read-only migration preflight and lock/runtime estimates.
7. Apply approved additive migrations using the separate migration role.
8. Run immediate schema/data reconciliation before application cutover.
9. Deploy the API using the immutable reviewed version.
10. Deploy the worker separately and verify schedules/deduplication before enabling outbound effects.
11. Publish/deploy the approved mobile build through owner-controlled Apple/Google accounts.
12. Run infrastructure and API health checks.
13. Run privacy-safe critical smoke tests.
14. Verify jobs, notification delivery, token cleanup and no duplicate effects.
15. Run database reconciliation queries using counts/internal IDs only.
16. Monitor error rate, latency, database health/connections/slow queries, jobs, storage and mobile crashes.
17. Record result, deviations, evidence and owner acceptance.

Exact provider commands must be added only after ADR-022 is Accepted and rehearsed in staging. Do not copy legacy `/opt/fivematch` commands into production procedure without verifying the selected architecture and owner accounts.

## 5. Migration controls

- Application runtime uses the application role and cannot alter schemas.
- Human-reviewed migration uses a time-limited migration role.
- Migration preflight is read-only and records affected counts/internal IDs.
- Prefer additive expand/backfill/validate/cutover/contract sequencing.
- Backfills are idempotent, bounded, observable and separately stoppable.
- Lock/statement timeouts are explicitly chosen and rehearsed.
- Historical OVR values/formula and pronostic arithmetic/bankroll are protected by unchanged golden tests.
- Ambiguous historical records go to manual review; migrations do not guess intent.
- A migration failure does not trigger an improvised destructive rollback.

## 6. Health and smoke checks

Minimum checks after API/worker deployment:

- service/container/process health and TLS certificate;
- API health endpoint and authentication boundary;
- privacy-safe match discovery and authenticated match detail;
- standalone/crew match capabilities for approved fixture users;
- PostgreSQL availability, connections, replication/PITR status where applicable and slow-query alerts;
- worker heartbeat, queues/outbox, retries and no duplicate notifications;
- object-storage access without public/private leakage;
- account data export/deletion path in staging rehearsal;
- mobile deep links, sign-in continuation and core match journeys;
- PR-055 visual behavior unchanged except approved minimal states.

Smoke fixtures must be synthetic and clearly named. Do not use real player profiles as release probes.

## 7. Stop conditions

Stop deployment immediately when:

- target environment/region/role is ambiguous or mismatched;
- a required test, audit, backup, restore or rehearsal lacks evidence;
- backup fails or checksum cannot be verified;
- migration differs from reviewed SQL or exceeds rehearsed locks/runtime;
- database reconciliation diverges unexpectedly;
- production database is publicly exposed or runtime has migration privileges;
- elevated errors, latency, connection exhaustion, job duplication or notification leakage occurs;
- secrets appear in logs/output;
- a processor, region, privacy or deletion approval is missing;
- a P0/P1 or security blocker is discovered;
- mobile build introduces an unrelated visual/design-system change.

The incident lead decides whether to halt, forward-fix or invoke the tested recovery plan. Never continue merely to finish the checklist.

## 8. Rollback or forward-fix

Before deployment, classify each change:

- application rollback compatible with both old/new schema;
- forward-fix required because migration is additive and data has changed;
- mobile rollout cannot be instantaneously recalled and needs server compatibility;
- database restore required only for a severe approved recovery case.

Rollback steps must be rehearsed in staging. Database restore is not a routine code rollback and follows `docs/runbooks/backup-and-restore.md`. Never recompute all historical OVR values or silently repair ambiguous data during rollback.

## 9. Post-deployment monitoring

| Signal | Baseline/threshold | Alert destination | Owner | Observation window | Result |
|---|---|---|---|---|---|
| API error rate/latency | TBD from staging/load tests | Owner-controlled TBD | TBD | TBD | Not run |
| CPU/memory/disk | TBD | Owner-controlled TBD | TBD | TBD | Not run |
| PostgreSQL health/connections/slow queries | TBD | Owner-controlled TBD | TBD | TBD | Not run |
| Failed/duplicate jobs | Zero unexpected; exact threshold TBD | Owner-controlled TBD | TBD | TBD | Not run |
| Backup failure | Any failure | Owner-controlled TBD | TBD | Continuous | Not run |
| Storage/notification failure | TBD | Owner-controlled TBD | TBD | TBD | Not run |
| Mobile crash rate | TBD | Owner-controlled TBD | TBD | TBD | Not run |
| TLS expiry | Alert well before expiry; interval TBD | Owner-controlled TBD | TBD | Continuous | Not run |

## 10. Staging rehearsal record

Production deployment is blocked until this record is complete:

| Rehearsal | Result/evidence |
|---|---|
| Independent staging provisioned in approved region | Not run |
| Synthetic/anonymized representative data restored | Not run |
| All migrations and reconciliation | Not run |
| Full API/worker/mobile critical journeys | Not run |
| Backup and full restore | Not run |
| Read-only database access/revocation | Not run |
| Account data export/deletion | Not run |
| Photo consent/deletion if enabled | Disabled; approval not granted |
| Rollback/forward-fix | Not run |
| Failed deployment simulation | Not run |
| PostgreSQL unavailable simulation | Not run |
| Failed background job simulation | Not run |
| Monitoring and alerts delivered to owner | Not run |
| PR-055 supported-size/accessibility check | Not run |
| Owner sign-off/date | Not approved |

## 11. Final launch recommendation

Current recommendation: **DO NOT LAUNCH**. Phase 8 has not begun, ADR-022 is Open, infrastructure ownership/regions/costs are unverified, and staging/backup/restore/deployment evidence does not exist.

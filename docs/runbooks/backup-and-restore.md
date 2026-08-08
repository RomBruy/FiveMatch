# Backup and Restore Runbook

Status: Phase 8 draft; no backup or restore evidence accepted
Last reviewed: 2026-08-06

A backup is valid only after an authorized restore into an isolated staging/recovery database succeeds and reconciliation checks pass. Existing backup scripts or old recovery notes are not proof of encryption, ownership, region, alerting, retention or recoverability.

Do not execute production restore commands from this draft. Never restore over development, staging or production without resolving and approving the exact target.

## 1. Approved policy fields

All `TBD` values block production launch.

| Control | Required value | Owner/evidence |
|---|---|---|
| Responsible owner | TBD; app-owner-controlled primary and backup person | TBD |
| Database backup frequency | TBD based on approved RPO | TBD |
| Retention | TBD; daily/weekly/monthly policy and delayed deletion disclosed | TBD |
| Backup region/country | TBD; approved European location or reviewed transfer | TBD |
| Encryption in transit | Required; mechanism/TLS evidence TBD | TBD |
| Encryption at rest | Required; key owner/rotation/recovery TBD | TBD |
| Off-server storage | Required; separate failure domain/account controls TBD | TBD |
| Backup failure alert | Required to owner-controlled destination | TBD |
| Restore-test frequency | At least once before launch and periodically thereafter; exact schedule TBD | TBD |
| Target RPO / acceptable data loss | TBD and owner-approved | TBD |
| Target RTO / expected recovery time | TBD and proven by rehearsal | TBD |
| Object-storage recovery | Backup or approved regeneration/deletion-aware strategy TBD | TBD |
| Configuration recovery | Versioned non-secret config plus secret-manager recovery TBD | TBD |

The legacy runbook mentions daily/weekly B2 paths and a 30-minute recovery target. Those are historical intentions, not accepted Phase 8 evidence.

## 2. Backup scope

The approved process must cover:

- PostgreSQL schema, data, extensions and migration journal;
- required database roles/grants as separately reproducible configuration, without storing role passwords in the dump;
- object/image source and generated files, or a documented regeneration strategy that respects withdrawn consent/deletion;
- deployment configuration excluding secrets;
- secret-manager account recovery and rotation, never plaintext secret backups in Git;
- domain/DNS, monitoring, alert and job-worker configuration needed to recover service.

Backup retention must not resurrect data after a deletion request without a documented delayed-deletion policy and re-deletion procedure after restore.

## 3. Backup procedure requirements

1. Identify environment, database, region and responsible person.
2. Confirm the backup role has the minimum required read permissions.
3. Produce a consistent custom-format PostgreSQL dump or provider-native backup.
4. Encrypt before or at storage using owner-controlled recovery procedures.
5. Upload to approved off-server storage in the documented region.
6. Record checksum, size, PostgreSQL version, schema/migration version, start/end time and result without personal data.
7. Emit success/failure telemetry; failures alert an owner-controlled destination.
8. Enforce approved lifecycle retention.
9. Select scheduled backups periodically for full restore testing.

Example self-hosted dump pattern, to be completed only after provider/role approval:

```bash
PGPASSWORD='<BACKUP_ROLE_PASSWORD>' pg_dump \
  --host='<PRIVATE_DATABASE_HOST>' \
  --port='5432' \
  --username='<BACKUP_ROLE>' \
  --dbname='<SOURCE_DATABASE>' \
  --format=custom \
  --no-owner \
  --file='/secure-temporary-path/<TIMESTAMP>.pgdump'
```

Do not put the password in a committed script or terminal transcript. The production implementation must retrieve it from the approved secret mechanism and remove temporary plaintext artifacts after verified upload.

## 4. Isolated staging restore procedure

This procedure must first be executed with synthetic or approved anonymized representative data. Resolve the exact target through read-only metadata before any destructive database creation/drop step.

1. Open an approved restore change record.
2. Select a backup and verify region, timestamp, checksum, encryption/decryption and PostgreSQL compatibility.
3. Provision a new empty database named unmistakably, for example `<PROJECT>_restore_test_<DATE>`; never reuse the application staging database for the first rehearsal.
4. Block API/worker/notification/cron access to the restore target.
5. Use a restore-only role and the private connection.
6. Restore without ownership/ACL inheritance.
7. Run schema, row-count, FK, uniqueness, ledger and migration-journal validation.
8. Start an isolated application instance only after mutation/notification integrations are disabled.
9. Run approved smoke tests.
10. Record elapsed time, failures, RPO/RTO outcome and responsible reviewer.
11. Destroy the restore-test database and temporary decrypted files after evidence is retained safely.

Example restore command for the newly created isolated target only:

```bash
PGPASSWORD='<RESTORE_ROLE_PASSWORD>' pg_restore \
  --host='<PRIVATE_RESTORE_HOST>' \
  --port='5432' \
  --username='<RESTORE_ROLE>' \
  --dbname='<NEW_EMPTY_RESTORE_TEST_DATABASE>' \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  '/secure-temporary-path/<APPROVED_BACKUP>.pgdump'
```

The command intentionally has no `--clean` flag. Target creation/deletion requires a separately reviewed, explicit operation so a mistaken connection cannot silently overwrite an existing database.

## 5. Restore validation

Validation returns aggregates and internal IDs only; do not copy profile text, emails, tokens, notes, image URLs or raw ratings into evidence.

- PostgreSQL version/extensions are compatible.
- Migration journal matches the recorded application version.
- Required schemas/tables/indexes/constraints exist.
- Table counts reconcile with pre-backup control totals where available.
- No orphaned required foreign keys or invalid uniqueness conditions exist.
- Global-player identity, match participation, rating, card, OVR-event and bankroll reconciliation checks pass.
- Optional images are present/regenerable only where consent remains valid.
- Deleted accounts/objects are not incorrectly resurrected into active processing.
- API health and critical read paths pass against the isolated restore.
- Workers, outbound email/push and external mutations remain disabled during rehearsal.
- Measured recovery time/data-loss window meet approved RTO/RPO.

## 6. Object storage and deletion

Choose and document one approved strategy:

- versioned/encrypted backup with matching retention and deletion ledger; or
- regeneration from a retained source only while consent/purpose remains valid; or
- no backup for derived output, with explicit user-facing recovery expectations.

Source photos, generated photos and moderation artifacts need distinct retention. A database restore must trigger reconciliation so objects belonging to deleted/withdrawn accounts are not restored or reprocessed.

## 7. Secrets and configuration recovery

- Store non-secret infrastructure/application configuration in reviewed version control.
- Store production secrets only in the approved platform secret store or protected server environment with restricted permissions.
- Maintain owner-controlled account recovery, break-glass access and secret inventory without recording values here.
- Test recovery by rotating non-production secrets and restoring staging configuration.
- Rotate production secrets after suspected exposure or emergency administrator use.

## 8. Restore evidence record

| Field | Result |
|---|---|
| Rehearsal date/time | Not run |
| Source type and age | TBD |
| Source data classification | Synthetic/anonymized required; TBD |
| Source/target region | TBD |
| Backup checksum verified | No evidence |
| Restore target | TBD |
| PostgreSQL/application version | TBD |
| Start/end/elapsed time | TBD |
| Validation queries/results | TBD |
| RPO/RTO met | Not evaluated |
| Notifications/external jobs disabled | TBD |
| Cleanup verified | TBD |
| Responsible operator/reviewer | TBD |
| Incidents/follow-up | TBD |

## 9. Stop conditions

Stop if the target is ambiguous, resembles production/development, contains existing data, lacks approval, is publicly exposed, uses production runtime credentials, would trigger jobs/notifications, requires an unreviewed destructive option, lacks a verified checksum/key, or contains unapproved production personal data.

Production launch remains blocked until at least one full staging restore succeeds, evidence is reviewed, alerts are tested, and the app owner can execute or supervise this runbook.

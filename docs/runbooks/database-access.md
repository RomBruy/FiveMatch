# Database Access Runbook

Status: Phase 8 draft; staging/production access not provisioned or approved
Last reviewed: 2026-08-06

This runbook defines the required workflow but contains no credentials or real hostnames. Replace placeholders only in an owner-approved secret manager or local shell session. Never paste a connection string, password, SSH key, token, personal data or production screenshot into documentation, tickets or chat.

## 1. Supported clients

- Command line: PostgreSQL `psql` for deterministic verification.
- Visual inspection: DBeaver Community is the proposed supported visual client; pgAdmin or TablePlus may be approved as an equivalent during Phase 8.

A visual client is not an authorization boundary. The database role must enforce read-only access regardless of client settings.

## 2. Roles and permissions

| Role | Used by | Required permissions | Forbidden |
|---|---|---|---|
| Application role | Running API/worker | Connect plus only runtime DML/sequence/schema usage required by the application | Schema ownership, role management, migration DDL, superuser |
| Migration role | Human-approved deployment migration step | Reviewed DDL/DML required for the specific migration | Normal API runtime, unreviewed interactive use |
| Read-only administrator | Owner-approved support/audit user | Connect, schema visibility and `SELECT` on approved objects; database default transaction read-only | Insert/update/delete, DDL, migrations, jobs, notification mutations |
| Emergency administrator | Recovery incident lead | Minimum elevated privileges needed for documented recovery | Routine support, normal deployment, shared credentials |

Roles are separate, named, individually attributable where supported, MFA-protected at the access layer and reviewed at least quarterly. Emergency use is logged and followed by credential rotation/access review.

## 3. Environment identification

Before any connection, independently verify all four values:

| Environment | Host | Port | Database | Expected role |
|---|---|---:|---|---|
| Local development | `127.0.0.1` or approved local Docker host | project-specific | clearly suffixed `_dev` | local app/developer role |
| Automated test | isolated CI/Docker service | test-specific | contains explicit `_test` marker | ephemeral test role |
| Staging | `<STAGING_PRIVATE_HOST>` via approved tunnel/private connection | `<LOCAL_TUNNEL_PORT>` | clearly suffixed `_staging` | staging app/migration/read-only role as task requires |
| Production | `<PRODUCTION_PRIVATE_HOST>` via approved tunnel/private connection | `<LOCAL_TUNNEL_PORT>` | clearly suffixed `_prod` | read-only role for inspection; migration role only during approved deployment |

If host, database name, role, region or task authorization does not match, stop. Never “try the connection” to discover which database it is.

After connecting, run only safe identity checks first:

```sql
SELECT current_database(), current_user;
SHOW transaction_read_only;
SELECT inet_server_addr(), inet_server_port();
```

For production inspection, `transaction_read_only` must be `on`. Do not continue if it is `off`.

## 4. Local connection

Use only a local development or explicitly disposable database. Do not reuse `AUDIT_DATABASE_URL`, staging or production credentials.

```bash
psql 'postgresql://<LOCAL_USER>:<LOCAL_PASSWORD>@127.0.0.1:<LOCAL_PORT>/<LOCAL_DATABASE>?sslmode=disable'
```

Prefer a shell environment variable or password manager integration so the password is not stored in shell history. The full URI above is a placeholder pattern only.

## 5. Staging secure connection

The selected hosting architecture must document either a private network/VPN/provider connector or an owner-controlled SSH tunnel. PostgreSQL must not be publicly exposed.

Proposed SSH-tunnel pattern:

```bash
ssh -N \
  -L 127.0.0.1:<LOCAL_STAGING_PORT>:<STAGING_DATABASE_PRIVATE_HOST>:5432 \
  <OWNER_APPROVED_SSH_USER>@<STAGING_BASTION_HOST>
```

In a separate terminal:

```bash
psql 'postgresql://<STAGING_READ_ONLY_USER>:<PASSWORD>@127.0.0.1:<LOCAL_STAGING_PORT>/<STAGING_DATABASE>?sslmode=<REQUIRED_MODE>'
```

Staging contains synthetic or approved anonymized data only. If real personal data is observed, stop, record the incident without copying the data and notify the responsible owner.

## 6. Production read-only connection

Production access requires a ticket/change record, task purpose, approved person, start/end time and an individually attributable read-only role. Use the selected private connection; never open port 5432 publicly.

Proposed SSH-tunnel pattern:

```bash
ssh -N \
  -L 127.0.0.1:<LOCAL_PRODUCTION_PORT>:<PRODUCTION_DATABASE_PRIVATE_HOST>:5432 \
  <OWNER_APPROVED_SSH_USER>@<PRODUCTION_BASTION_HOST>
```

Then connect with the read-only role and immediately verify environment/role/read-only state:

```bash
psql 'postgresql://<PRODUCTION_READ_ONLY_USER>:<PASSWORD>@127.0.0.1:<LOCAL_PRODUCTION_PORT>/<PRODUCTION_DATABASE>?sslmode=<REQUIRED_MODE>'
```

The role and database must enforce read-only access. A `BEGIN READ ONLY` statement is additional protection, not a substitute:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
```

End inspection with `ROLLBACK;` even though no mutation was intended.

## 7. DBeaver visual workflow

1. Install DBeaver from an owner-approved source and verify updates.
2. Start the approved SSH tunnel separately; do not ask DBeaver to store the SSH private key unless the security owner approves its credential-store configuration.
3. Create a connection named conspicuously: `FIVEMATCH LOCAL`, `FIVEMATCH STAGING`, or `FIVEMATCH PRODUCTION READ ONLY`.
4. Use `127.0.0.1`, the assigned local tunnel port, exact database name and correct read-only user.
5. Set the production connection color to a warning color as a local operator aid. This does not replace database permissions.
6. Disable saving the password unless the approved OS credential store is used.
7. Connect, open a SQL editor and run the identity/read-only checks from section 3.
8. Inspect schemas, foreign keys and indexes through metadata views. Do not edit table data grids.
9. Use aggregate/count queries; avoid opening broad rows containing email, notes, tokens, photos or raw ratings.
10. Disconnect, close the SSH tunnel and record completion in the access ticket.

Screenshots may show only empty schema/relationship metadata or synthetic data. Crop hostnames/account names if they are not intended for the audience. Never capture credentials or production personal data.

## 8. Safe inspection examples

Prefer catalog metadata and counts:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT relname AS table_name, n_live_tup AS estimated_rows
FROM pg_stat_user_tables
ORDER BY relname;
```

Exact approved counts should name tables explicitly and return counts/internal identifiers only. Avoid `SELECT *`. Do not inspect `users.email`, tokens, profile text, image URLs, free-text notes, raw rating values or processor credentials unless a separately approved support/legal purpose requires it.

## 9. Access grant, exit and revocation

Grant procedure:

1. Owner approves purpose, person, environment, role and expiry.
2. Administrator creates/activates an individual role through the selected secure channel.
3. Grant only required connect/schema/select permissions.
4. Enforce read-only default and connection/statement timeouts where appropriate.
5. Deliver credentials through the owner-approved secret manager.
6. User verifies role and environment without viewing unnecessary records.

Exit/revocation procedure:

1. End/rollback transactions and disconnect the visual/CLI client.
2. Stop the tunnel/VPN session.
3. Remove temporary environment variables and local connection profiles/passwords where required.
4. Revoke/expire the database role and secure-access entitlement.
5. Review connection/audit logs and record the outcome.
6. Rotate shared/emergency credentials if they were used.

## 10. Stop conditions

Stop immediately if:

- the target cannot be identified without revealing a secret;
- production port 5432 is publicly reachable;
- the production role is not database-enforced read-only for an inspection;
- local/test tooling points to staging or production;
- a staging database contains unapproved production personal data;
- a visual client exposes or caches credentials unexpectedly;
- the requested query could mutate, lock broadly, trigger jobs or export unnecessary personal data;
- approval, responsible owner or access expiry is missing.

This draft becomes operational only after both staging and production procedures are filled with secret-free metadata, tested by the owner, and evidenced in the Phase 8 rehearsal record.

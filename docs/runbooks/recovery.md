# FiveMatch — Production Recovery Runbook

**Server:** Hetzner CX31 (4 vCPU / 8 GB RAM)
**Deploy path:** `/opt/fivematch`
**Stack:** Docker Compose — api + postgres + pgbouncer + backup

---

## Detecting an Outage

### Automated Alerts
- **Sentry** fires on API 5xx errors or unhandled exceptions — check the FiveMatch Sentry project
- **Backup job failure** — Sentry alert from `backup-pg.sh` if pg_dump or B2 upload fails

### Manual Health Check
```bash
# Check all containers are running
ssh deploy@<VPS_IP>  # TODO: replace with actual VPS IP before production use
cd /opt/fivematch
docker compose ps

# Check API is responding
curl -sf http://localhost:3000/health && echo "API OK" || echo "API DOWN"

# Check DB connection
docker compose exec postgres pg_isready -U fivematch -d fivematch_prod
```

### Key Error Signatures
| Symptom | Likely Cause | First Action |
|---------|-------------|--------------|
| API returns 503 | Container crash or OOM | `docker compose logs api --tail=50` |
| DB connection refused | PgBouncer or Postgres down | `docker compose ps pgbouncer postgres` |
| All containers stopped | VPS reboot (Docker restart policy handles this) | `docker compose up -d` |
| Backup alert in Sentry | B2 credentials expired or disk full on /tmp | SSH in, run `backup-pg.sh` manually |

---

## Restarting Containers

### Quick Restart (All Services)
```bash
ssh deploy@<VPS_IP>  # TODO: replace with actual VPS IP before production use
cd /opt/fivematch
docker compose up -d
```

### Restart Single Service
```bash
docker compose restart api        # Restart only the API
docker compose restart pgbouncer  # Restart only PgBouncer (does not affect Postgres data)
```

### Full Redeploy (After New Image)
```bash
docker compose pull
docker compose up -d
docker compose logs --tail=20 api  # Confirm healthy startup
```

### Post-Restart Verification
```bash
docker compose ps                                  # All containers "Up"
curl -sf http://localhost:3000/health              # API responding
docker compose exec postgres pg_isready -U fivematch -d fivematch_prod  # DB ready
docker compose logs pgbouncer --tail=10            # No auth errors
```

---

## Restoring from Backup

### Step 1 — Download the Latest Backup from B2
```bash
# On the VPS with b2 CLI installed (pip3 install b2)
b2 authorize-account "${B2_KEY_ID}" "${B2_APPLICATION_KEY}"
b2 ls fivematch-prod/backups/daily/               # List available daily backups
b2 download-file-by-name fivematch-prod \
  backups/daily/YYYYMMDD/fivematch-<TIMESTAMP>.pgdump \
  /tmp/restore.pgdump
```

### Step 2 — Stop the API (to prevent writes during restore)
```bash
cd /opt/fivematch
docker compose stop api
```

### Step 3 — Copy the Backup into the Postgres Container
```bash
# Option A: docker cp (recommended — clearer under stress)
docker compose cp /tmp/restore.pgdump postgres:/tmp/restore.pgdump
```

### Step 4 — Restore to PostgreSQL
```bash
# Drop and recreate the database
docker compose exec postgres psql -U fivematch -c "DROP DATABASE IF EXISTS fivematch_prod;"
docker compose exec postgres psql -U fivematch -c "CREATE DATABASE fivematch_prod;"

# Restore from backup (pg_restore uses custom format -Fc produced by backup-pg.sh)
docker compose exec postgres pg_restore \
  -U fivematch \
  -d fivematch_prod \
  --no-owner \
  --no-acl \
  /tmp/restore.pgdump
```

### Step 5 — Restart Everything
```bash
docker compose up -d
docker compose logs --tail=30 api
curl -sf http://localhost:3000/health
```

### Step 6 — Verify Data Integrity
```bash
# Spot-check row counts
docker compose exec postgres psql -U fivematch -d fivematch_prod \
  -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM matches; SELECT COUNT(*) FROM players;"
```

---

## Estimated Recovery Time

| Scenario | RTO | Automatic? |
|----------|-----|------------|
| API container crash | ~2 min | Yes — `restart: unless-stopped` |
| API OOM kill | ~3 min | Yes — Docker restart |
| PgBouncer restart | ~1 min | Yes — Docker restart |
| Full VPS reboot | ~5 min | Yes — Docker starts on boot |
| Postgres crash (data intact) | ~5 min | Yes — Docker restart + WAL recovery |
| Full DB restore from B2 (last backup) | ~30 min | Manual |
| VPS unreachable (Hetzner incident) | ~30–120 min | Manual — Hetzner support |

**Target SLA (NFR-5):** ≤30 minutes unplanned downtime per week. Automated restart covers all common scenarios within this SLA. Full DB restore is the only case that risks exceeding it.

---

## User Communication Plan

### During Outage (>5 minutes)
1. **Internal:** Post in team Slack (#fivematch-incidents): `@here — FiveMatch API down since [TIME]. Investigating.`
2. **Wait for diagnosis** — do not communicate externally until root cause is known

### Confirmed Outage (>10 minutes)
Status message template (post to app's status channel or website):
```
🔴 FiveMatch is experiencing issues since [TIME UTC].
Match data is safe. We're working to restore service.
Next update: [TIME + 15min]
```

### Resolution Message
```
✅ FiveMatch is back online as of [TIME UTC].
Duration: [X] minutes. Cause: [brief description].
All data was preserved. We're sorry for the disruption.
```

### Post-Mortem (for outages >10 min)
- Written within 48 hours
- Covers: timeline, root cause, resolution, prevention
- Shared in team Slack

---

## Initial VPS Setup — B2 Lifecycle Policy

Run once during VPS provisioning (not in the backup script):
```bash
b2 authorize-account "${B2_KEY_ID}" "${B2_APPLICATION_KEY}"
b2 update-bucket --lifecycleRules '[
  {"daysFromHidingToDeleting":7,"daysFromUploadingToHiding":0,"fileNamePrefix":"backups/daily/"},
  {"daysFromHidingToDeleting":28,"daysFromUploadingToHiding":0,"fileNamePrefix":"backups/weekly/"}
]' "${B2_BUCKET_NAME}" allPublic
```

This enforces: daily backups retained 7 days, weekly backups (every Sunday) retained 4 weeks.

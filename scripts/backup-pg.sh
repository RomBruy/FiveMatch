#!/usr/bin/env bash
set -euo pipefail

# Required env vars
: "${POSTGRES_HOST:?POSTGRES_HOST not set}"
: "${POSTGRES_DB:?POSTGRES_DB not set}"
: "${POSTGRES_USER:?POSTGRES_USER not set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD not set}"
: "${B2_BUCKET_NAME:?B2_BUCKET_NAME not set}"
: "${B2_KEY_ID:?B2_KEY_ID not set}"
: "${B2_APPLICATION_KEY:?B2_APPLICATION_KEY not set}"
: "${SENTRY_DSN:=}"  # Optional — if empty, Sentry errors are skipped

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_FILE="/tmp/fivematch-backup-${TIMESTAMP}.pgdump"

cleanup() {
  rm -f "${BACKUP_FILE}"
}
trap cleanup EXIT

report_sentry_error() {
  local msg="$1"
  if [ -n "${SENTRY_DSN}" ]; then
    curl -s -X POST "${SENTRY_DSN}" \
      -H 'Content-Type: application/json' \
      -d "{\"message\":\"${msg}\",\"level\":\"error\",\"logger\":\"backup-pg\"}" || true
  fi
}

echo "[$(date -u +%FT%TZ)] Starting backup of ${POSTGRES_DB}..."

# pg_dump with custom format (most efficient for pg_restore)
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -Fc \
  -f "${BACKUP_FILE}" || {
    report_sentry_error "pg_dump failed for ${POSTGRES_DB} at ${TIMESTAMP}"
    echo "[$(date -u +%FT%TZ)] ERROR: pg_dump failed" >&2
    exit 1
  }

echo "[$(date -u +%FT%TZ)] pg_dump complete. Uploading to B2..."

# Authorise B2 CLI and upload
b2 authorize-account "${B2_KEY_ID}" "${B2_APPLICATION_KEY}" || {
    report_sentry_error "B2 authorize-account failed at ${TIMESTAMP}"
    echo "[$(date -u +%FT%TZ)] ERROR: B2 auth failed" >&2
    exit 1
  }

# Daily backup path: backups/daily/YYYYMMDD/backup.pgdump
DAY_OF_WEEK=$(date -u +%u)  # 1=Mon … 7=Sun
DATE_DIR=$(date -u +"%Y%m%d")
REMOTE_PATH="backups/daily/${DATE_DIR}/fivematch-${TIMESTAMP}.pgdump"

b2 upload-file "${B2_BUCKET_NAME}" "${BACKUP_FILE}" "${REMOTE_PATH}" || {
    report_sentry_error "B2 upload failed for ${REMOTE_PATH} at ${TIMESTAMP}"
    echo "[$(date -u +%FT%TZ)] ERROR: B2 upload failed" >&2
    exit 1
  }

# If today is Sunday (7), also copy to weekly path for extended retention
if [ "${DAY_OF_WEEK}" = "7" ]; then
  WEEK_DIR=$(date -u +"%Y-W%V")
  WEEKLY_REMOTE_PATH="backups/weekly/${WEEK_DIR}/fivematch-${TIMESTAMP}.pgdump"
  b2 copy-file-by-name "${B2_BUCKET_NAME}" "${REMOTE_PATH}" \
                        "${B2_BUCKET_NAME}" "${WEEKLY_REMOTE_PATH}" || {
      echo "[$(date -u +%FT%TZ)] WARN: Weekly copy failed — daily backup still uploaded" >&2
    }
  echo "[$(date -u +%FT%TZ)] Weekly backup copied to ${WEEKLY_REMOTE_PATH}"
fi

echo "[$(date -u +%FT%TZ)] Backup complete: ${REMOTE_PATH}"

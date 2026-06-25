#!/usr/bin/env bash
# Database backup script — run via cron or CI
# Usage: ./scripts/backup-db.sh
# Requires: pg_dump, gzip, and optionally aws cli for S3 upload

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_FILE="nexushq_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting database backup..."
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

FILESIZE=$(stat -f%z "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null || echo "unknown")
echo "[backup] Created ${BACKUP_FILE} (${FILESIZE} bytes)"

# Upload to S3 if bucket configured
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "[backup] Uploading to s3://${BACKUP_S3_BUCKET}/db-backups/${BACKUP_FILE}"
  aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${BACKUP_S3_BUCKET}/db-backups/${BACKUP_FILE}" \
    --storage-class STANDARD_IA
  echo "[backup] S3 upload complete"
fi

# Clean up old local backups
echo "[backup] Removing local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "nexushq_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

echo "[backup] Done."

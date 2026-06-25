#!/usr/bin/env bash
# Database restore script
# Usage: ./scripts/restore-db.sh <backup-file.sql.gz>
# WARNING: This will DROP and recreate the database!

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo "Available backups:"
  ls -la "${BACKUP_DIR:-./backups}"/nexushq_*.sql.gz 2>/dev/null || echo "  (none found)"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] Error: File not found: $BACKUP_FILE"
  exit 1
fi

echo "[restore] WARNING: This will overwrite the current database!"
echo "[restore] Restoring from: $BACKUP_FILE"
echo "[restore] Target: $DATABASE_URL"
read -p "[restore] Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "[restore] Aborted."
  exit 0
fi

echo "[restore] Restoring..."
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --quiet

echo "[restore] Running Prisma migrations..."
cd apps/api && npx prisma migrate deploy

echo "[restore] Restore complete."

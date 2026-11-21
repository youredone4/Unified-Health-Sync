#!/bin/sh
# Runs backup.sh once a day at BACKUP_HOUR_UTC (default 18 = 2 AM in Manila),
# and once shortly after start-up if no backup exists yet. This is the
# entrypoint of the `backup` service in docker-compose.yml.
#
# A failed backup is logged and retried at the next scheduled time; it does
# not stop the container. Check on it with:  docker compose logs backup
set -u

BACKUP_DIR="${BACKUP_DIR:-/backups}"
HOUR="${BACKUP_HOUR_UTC:-18}"

run_backup() {
  if /scripts/backup.sh; then
    date -u +%Y-%m-%dT%H:%M:%SZ > "$BACKUP_DIR/.last-success"
  else
    echo "[backup] *** BACKUP FAILED at $(date -u +%Y-%m-%dT%H:%M:%SZ) *** see messages above" >&2
  fi
}

if ! ls "$BACKUP_DIR"/healthsync-*.dump.gpg >/dev/null 2>&1; then
  echo "[backup] no backups found; taking the first one in 60 seconds"
  sleep 60
  run_backup
fi

while true; do
  NOW_H="$(date -u +%H)"; NOW_M="$(date -u +%M)"; NOW_S="$(date -u +%S)"
  # Strip leading zeros so the shell does not read 08/09 as octal.
  NOW_H="${NOW_H#0}"; NOW_M="${NOW_M#0}"; NOW_S="${NOW_S#0}"
  NOW_SECS=$(( NOW_H * 3600 + NOW_M * 60 + NOW_S ))
  TARGET_SECS=$(( HOUR * 3600 ))
  WAIT=$(( TARGET_SECS - NOW_SECS ))
  [ "$WAIT" -le 0 ] && WAIT=$(( WAIT + 86400 ))
  echo "[backup] next backup in $(( WAIT / 3600 ))h $(( (WAIT % 3600) / 60 ))m"
  sleep "$WAIT"
  run_backup
done

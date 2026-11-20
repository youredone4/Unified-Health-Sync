#!/bin/sh
# Restore a HealthSync backup made by backup.sh.
#
#   restore.sh <file.dump.gpg>            restore into $PGDATABASE
#   restore.sh --check <file.dump.gpg>    only prove the file can be decrypted
#                                         and read; changes nothing
#
# A real restore REPLACES the contents of the target database. It refuses to
# run unless RESTORE_CONFIRM=yes is set, and the app should be stopped first:
#
#   docker compose stop app
#   docker compose exec -e RESTORE_CONFIRM=yes backup /scripts/restore.sh /backups/<file>
#   docker compose start app
#
# To rehearse a restore without touching live data, point PGDATABASE at a
# scratch database (see docs/deployment.md, "Practise a restore").
#
# Environment: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE, BACKUP_PASSPHRASE
set -eu
(set -o pipefail) 2>/dev/null && set -o pipefail

CHECK_ONLY=0
if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=1
  shift
fi
FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "usage: restore.sh [--check] <file.dump.gpg>" >&2
  exit 2
fi
if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "[restore] BACKUP_PASSPHRASE is not set." >&2
  exit 1
fi

GNUPGHOME="$(mktemp -d)"
export GNUPGHOME
trap 'rm -rf "$GNUPGHOME"' EXIT

decrypt() {
  gpg --batch --quiet --yes --no-tty --pinentry-mode loopback --passphrase-fd 3 --decrypt "$FILE" 3<<EOF
$BACKUP_PASSPHRASE
EOF
}

TABLES="$(decrypt | pg_restore --list | grep -c ' TABLE DATA ' || true)"
if [ "${TABLES:-0}" -lt 1 ]; then
  echo "[restore] FAILED: $FILE could not be decrypted or is not a valid backup (wrong passphrase?)." >&2
  exit 1
fi
echo "[restore] $FILE is readable: $TABLES tables."
[ "$CHECK_ONLY" -eq 1 ] && exit 0

if [ "${RESTORE_CONFIRM:-}" != "yes" ]; then
  echo "[restore] This will REPLACE everything in database '${PGDATABASE:-}'." >&2
  echo "[restore] Stop the app first, then re-run with RESTORE_CONFIRM=yes." >&2
  exit 1
fi

echo "[restore] restoring into ${PGDATABASE:-} ..."
decrypt | pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname "${PGDATABASE}"
echo "[restore] done."

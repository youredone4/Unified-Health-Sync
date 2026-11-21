#!/bin/sh
# HealthSync database backup: dump, encrypt, verify, prune.
#
# Produces  $BACKUP_DIR/healthsync-YYYYMMDD-HHMMSS.dump.gpg
#
# The dump is encrypted with GnuPG (AES-256, passphrase) before it touches
# the backup directory, so a copied or stolen backup file is useless without
# BACKUP_PASSPHRASE. A backup is only kept if it can be decrypted and read
# back by pg_restore; a failed or truncated dump is deleted and the script
# exits non-zero.
#
# Environment:
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE   standard libpq variables
#   BACKUP_PASSPHRASE   required; losing it means losing every backup
#   BACKUP_DIR          where backups are written (default /backups)
#   BACKUP_KEEP_DAYS    delete backups older than this many days (default 14)
#
# Normally run by the `backup` service in docker-compose.yml. To run one now:
#   docker compose exec backup /scripts/backup.sh
set -eu
(set -o pipefail) 2>/dev/null && set -o pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "[backup] BACKUP_PASSPHRASE is not set; refusing to write an unencrypted backup." >&2
  exit 1
fi
if [ "${#BACKUP_PASSPHRASE}" -lt 20 ]; then
  echo "[backup] BACKUP_PASSPHRASE is too short (use at least 20 characters: openssl rand -hex 24)." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
FINAL="$BACKUP_DIR/healthsync-$STAMP.dump.gpg"
PARTIAL="$FINAL.partial"

# GnuPG keeps its state in a throwaway directory; nothing is left behind.
GNUPGHOME="$(mktemp -d)"
export GNUPGHOME
cleanup() { rm -rf "$GNUPGHOME" "$PARTIAL"; }
trap cleanup EXIT

gpg_passphrase() {
  # Passphrase goes in on file descriptor 3, never on the command line
  # (where other processes could read it).
  gpg --batch --quiet --yes --no-tty --pinentry-mode loopback --passphrase-fd 3 "$@" 3<<EOF
$BACKUP_PASSPHRASE
EOF
}

echo "[backup] dumping database ${PGDATABASE:-} ..."
pg_dump --format=custom --no-owner --no-privileges \
  | gpg_passphrase --symmetric --cipher-algo AES256 --compress-algo none --output "$PARTIAL"

# Verify: it must decrypt, and pg_restore must be able to read its table of
# contents. This catches a truncated dump and a wrong passphrase alike.
TABLES="$(gpg_passphrase --decrypt "$PARTIAL" | pg_restore --list | grep -c ' TABLE DATA ' || true)"
if [ "${TABLES:-0}" -lt 1 ]; then
  echo "[backup] FAILED: the new backup could not be read back; it has been discarded." >&2
  exit 1
fi

mv "$PARTIAL" "$FINAL"
chmod 600 "$FINAL"
SIZE="$(wc -c < "$FINAL" | tr -d ' ')"
echo "[backup] ok: $FINAL ($SIZE bytes, $TABLES tables)"

# Prune old backups, but never the only one left.
find "$BACKUP_DIR" -name 'healthsync-*.dump.gpg' -type f -mtime "+$KEEP_DAYS" | while read -r OLD; do
  COUNT="$(find "$BACKUP_DIR" -name 'healthsync-*.dump.gpg' -type f | wc -l | tr -d ' ')"
  [ "$COUNT" -gt 1 ] || break
  rm -f "$OLD"
  echo "[backup] pruned $OLD"
done

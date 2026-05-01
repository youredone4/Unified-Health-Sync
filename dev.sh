#!/bin/bash
# Exclusive lock — if another copy of this script is already in the restart
# loop, exit immediately so we don't race to start node in parallel.
LOCKFILE=/tmp/healthsync-dev.lock

# Try to acquire the lock non-blocking.
exec 9>"$LOCKFILE"
if ! flock -n 9; then
  # Another instance holds the lock.  Kill it and take over.
  OLD=$(cat "${LOCKFILE}.pid" 2>/dev/null)
  [ -n "$OLD" ] && kill -9 "$OLD" 2>/dev/null || true
  pkill -9 -f 'node dist/index.cjs' 2>/dev/null || true
  sleep 2
  flock 9  # wait (now blocking) until we can acquire
fi
echo $$ > "${LOCKFILE}.pid"

# Kill any lingering server processes from previous runs.
pkill -9 -f 'tsx server/index' 2>/dev/null || true
pkill -9 -f 'node dist/index.cjs' 2>/dev/null || true
sleep 2

# Build helper. Called inside the restart loop so that if dist/ is wiped
# (e.g. the user deletes it to force a rebuild after a frontend PR
# lands), the next restart cycle rebuilds automatically instead of
# crash-looping with "Cannot find module dist/index.cjs".
build_if_missing() {
  if [ ! -f "dist/index.cjs" ]; then
    echo "[dev.sh] dist/index.cjs missing — building..."
    NODE_ENV=production npm run build
    if [ $? -ne 0 ]; then
      echo "[dev.sh] Build failed."
      return 1
    fi
  fi
  return 0
}

build_if_missing || exit 1

export NODE_ENV=production

# Restart loop — automatically brings the server back after any crash or
# platform idle-kill.  SIGTERM propagates to node; bash exits when node does.
while true; do
  build_if_missing || { sleep 5; continue; }
  echo "[dev.sh] Starting server..."
  node dist/index.cjs
  EXIT=$?
  echo "[dev.sh] Server exited (code $EXIT). Restarting in 3 s..."
  sleep 3
done

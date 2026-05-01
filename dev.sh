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

# Build the compiled server if it doesn't exist yet.
if [ ! -f "dist/index.cjs" ]; then
  echo "[dev.sh] Building application for first run..."
  export NODE_ENV=production
  npm run build
  if [ $? -ne 0 ]; then
    echo "[dev.sh] Build failed."
    exit 1
  fi
fi

export NODE_ENV=production

# Restart loop — automatically brings the server back after any crash or
# platform idle-kill.  SIGTERM propagates to node; bash exits when node does.
while true; do
  echo "[dev.sh] Starting server..."
  node dist/index.cjs
  EXIT=$?
  echo "[dev.sh] Server exited (code $EXIT). Restarting in 3 s..."
  sleep 3
done

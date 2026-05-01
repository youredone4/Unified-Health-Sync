#!/bin/bash
# Kill any other dev.sh processes (stale loops from previous crash cycles),
# but spare the current process ($$).
pgrep -f 'bash dev.sh' | grep -v "^$$\$" | xargs -r kill -9 2>/dev/null || true

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
echo "[dev.sh] Starting server..."

# exec replaces this shell with the node process so signals from Replit
# go directly to Node — no intermediate shell to swallow them.
exec node dist/index.cjs

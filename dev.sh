#!/bin/bash
export NODE_ENV=development

while true; do
  # Kill any leftover tsx process bound to the port before (re)starting.
  pkill -9 -f 'tsx server/index.ts' 2>/dev/null || true
  sleep 0.5

  echo "[dev.sh] Starting server..."
  node_modules/.bin/tsx server/index.ts
  EXIT=$?
  echo "[dev.sh] Server exited (code $EXIT). Restarting in 3 s..."
  sleep 3
done

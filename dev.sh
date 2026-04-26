#!/bin/bash
# Kill any previous server process before binding the port.
# pkill excludes its own PID, so this is safe to call from within a script
# that itself contains "tsx server/index.ts" in its argument list.
pkill -9 -f 'tsx server/index.ts' 2>/dev/null
sleep 0.5

# exec replaces this shell with the tsx process so SIGTERM/SIGINT from Replit
# go directly to Node — no intermediate npm/sh to swallow them.
export NODE_ENV=development
exec node_modules/.bin/tsx server/index.ts

#!/bin/bash
# Minimal dev runner. Replit's workflow ("Start application" in .replit)
# already supervises this process and restarts it if it exits — having a
# bash `while true` restart loop here on top of that creates two
# competing supervisors that each issue `pkill -9 -f 'tsx server/index.ts'`
# whenever they think they should restart, so the running tsx gets
# SIGKILL'd within seconds of binding to port 5000.
#
# `freePort` inside server/index.ts already handles the only real reason
# the loop existed — a zombie tsx still bound to 5000 from a previous
# run. Bowing out of the supervisor business and `exec`-ing tsx so the
# workflow sees the actual exit code keeps the wiring honest.
set -e
export NODE_ENV=development
exec node_modules/.bin/tsx server/index.ts

#!/bin/bash
# Free port 5000 by finding and killing its owning process via /proc/net/tcp.
# This handles zombie processes left over from previous workflow runs.
free_port_5000() {
  local PORT_HEX="1388"
  for netfile in /proc/net/tcp /proc/net/tcp6; do
    [ -f "$netfile" ] || continue
    while read -r sl local_addr remote_addr state tx_rx uid timeout inode rest; do
      local_port="${local_addr##*:}"
      if [ "${local_port}" = "${PORT_HEX}" ] || [ "${local_port}" = "${PORT_HEX,,}" ]; then
        for fddir in /proc/[0-9]*/fd; do
          pid="${fddir%/fd}"; pid="${pid##*/}"
          if ls -l "$fddir" 2>/dev/null | grep -q "socket:\[${inode}\]"; then
            echo "[dev.sh] Freeing port 5000 (PID $pid)"
            kill -9 "$pid" 2>/dev/null
            sleep 0.5
            return 0
          fi
        done
      fi
    done < "$netfile"
  done
}

free_port_5000

# exec replaces this shell with tsx so SIGTERM/SIGINT go directly to the
# Node.js process — no intermediate shell to swallow signals.
export NODE_ENV=development
exec node_modules/.bin/tsx server/index.ts

/**
 * Best-effort port-cleanup helper for Replit dev workflows.
 *
 * When tsx hot-reloads or the user manually restarts npm run dev, the
 * previous process sometimes lingers on port 5000 and blocks the new
 * server from binding. This module scans /proc to find the PID
 * holding the port and SIGKILLs it.
 *
 * Linux-only (which Replit is). On other platforms it's a no-op.
 */

import { promises as fs } from "fs";
import { setTimeout as sleep } from "timers/promises";

/**
 * Find the inode associated with a given listen port (TCP) by parsing
 * /proc/net/tcp. Returns the inode as a decimal string or null if
 * nothing is bound.
 */
async function findListenInode(port: number): Promise<string | null> {
  const portHex = port.toString(16).toUpperCase().padStart(4, "0");
  let raw: string;
  try {
    raw = await fs.readFile("/proc/net/tcp", "utf8");
  } catch {
    return null; // not on Linux
  }
  const lines = raw.split("\n");
  for (const line of lines) {
    // local_address column is at index 1: "00000000:1F90"
    const cols = line.trim().split(/\s+/);
    if (cols.length < 10) continue;
    const local = cols[1];
    if (!local || !local.endsWith(`:${portHex}`)) continue;
    // st column is index 3: "0A" = LISTEN
    if (cols[3] !== "0A") continue;
    return cols[9]; // inode
  }
  return null;
}

/**
 * Find the PID(s) that have the given socket inode open by scanning
 * /proc/[pid]/fd. Excludes the current process so we never SIGKILL
 * ourselves on a hot-reload.
 */
async function findPidsHoldingInode(inode: string): Promise<number[]> {
  const pids: number[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir("/proc");
  } catch {
    return pids;
  }
  const target = `socket:[${inode}]`;
  for (const name of entries) {
    if (!/^[0-9]+$/.test(name)) continue;
    const pid = Number(name);
    if (pid === process.pid) continue;
    let fds: string[];
    try {
      fds = await fs.readdir(`/proc/${pid}/fd`);
    } catch {
      continue; // process already gone, or no permission
    }
    for (const fd of fds) {
      let link: string;
      try {
        link = await fs.readlink(`/proc/${pid}/fd/${fd}`);
      } catch {
        continue;
      }
      if (link === target) {
        pids.push(pid);
        break;
      }
    }
  }
  return pids;
}

/**
 * Best-effort: free the given TCP port by killing the process(es)
 * that have its listener socket open. Logs every kill so the dev
 * shell makes it obvious what happened. Returns the number of PIDs
 * killed (0 = port was already free).
 */
export async function freePort(port: number): Promise<number> {
  const inode = await findListenInode(port);
  if (!inode) return 0;
  const pids = await findPidsHoldingInode(inode);
  if (pids.length === 0) return 0;
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
      console.log(`[startup] freed port ${port}: SIGKILL pid ${pid}`);
    } catch (err: any) {
      console.warn(`[startup] could not kill pid ${pid}: ${err.message}`);
    }
  }
  // Give the kernel a moment to release the socket before the caller
  // attempts to bind. 200ms is plenty for the FIN/TIME_WAIT flush.
  await sleep(200);
  return pids.length;
}

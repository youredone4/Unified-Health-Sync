/**
 * Scheduler entry point — Phase 3 of operational-actions framework.
 *
 * Uses self-rescheduling setTimeout instead of node-cron so we avoid the
 * dependency. Two jobs:
 *   - daily 6 AM (Asia/Manila)  → runDailyAlerts()
 *   - Friday 4 PM (Asia/Manila) → runWeeklyAlerts()
 *
 * The scheduler is idempotent + best-effort. If the process restarts mid-day
 * we don't try to "catch up" — we just run on the next configured slot. An
 * admin can fire jobs manually via POST /api/admin/run-scheduler-now.
 */

import { runDailyAlerts, runWeeklyAlerts } from "./jobs";

// Use Asia/Manila offset (UTC+8) for scheduling. We compute next-fire by
// converting "now" into Manila time, then bumping forward.
const MANILA_OFFSET_HOURS = 8;

/** Returns ms until the next time of day (h, m, in Manila TZ). */
function msUntilNext(hourManila: number, minuteManila = 0): number {
  const now = new Date();
  // Manila wall-clock right now.
  const nowManila = new Date(now.getTime() + MANILA_OFFSET_HOURS * 3600 * 1000);
  const target = new Date(nowManila);
  target.setUTCHours(hourManila, minuteManila, 0, 0);
  if (target <= nowManila) target.setUTCDate(nowManila.getUTCDate() + 1);
  return target.getTime() - nowManila.getTime();
}

/** Returns ms until the next Friday at hour:minute Manila time. */
function msUntilNextFriday(hourManila: number, minuteManila = 0): number {
  const now = new Date();
  const nowManila = new Date(now.getTime() + MANILA_OFFSET_HOURS * 3600 * 1000);
  const target = new Date(nowManila);
  target.setUTCHours(hourManila, minuteManila, 0, 0);
  // Friday = 5 (UTC weekday on Manila wall-clock)
  const daysUntilFriday = (5 - target.getUTCDay() + 7) % 7;
  target.setUTCDate(nowManila.getUTCDate() + daysUntilFriday);
  if (target <= nowManila) target.setUTCDate(target.getUTCDate() + 7);
  return target.getTime() - nowManila.getTime();
}

let dailyTimer: NodeJS.Timeout | null = null;
let weeklyTimer: NodeJS.Timeout | null = null;
let started = false;

function scheduleDaily() {
  const ms = msUntilNext(6, 0); // 6:00 AM Manila
  console.log(`[scheduler] next daily run in ${Math.round(ms / 60000)} minutes`);
  dailyTimer = setTimeout(async () => {
    console.log("[scheduler] running daily alerts");
    try {
      await runDailyAlerts();
    } catch (err) {
      console.error("[scheduler] daily run failed:", err);
    }
    scheduleDaily();
  }, ms);
}

function scheduleWeekly() {
  const ms = msUntilNextFriday(16, 0); // 4:00 PM Manila Friday
  console.log(`[scheduler] next weekly run in ${Math.round(ms / 3600000)} hours`);
  weeklyTimer = setTimeout(async () => {
    console.log("[scheduler] running weekly (Friday 4 PM) alerts");
    try {
      await runWeeklyAlerts();
    } catch (err) {
      console.error("[scheduler] weekly run failed:", err);
    }
    scheduleWeekly();
  }, ms);
}

export function startScheduler(): void {
  if (started) return;
  started = true;
  scheduleDaily();
  scheduleWeekly();
  console.log("[scheduler] started — daily 6 AM + Friday 4 PM (Asia/Manila)");
}

export function stopScheduler(): void {
  if (dailyTimer) clearTimeout(dailyTimer);
  if (weeklyTimer) clearTimeout(weeklyTimer);
  dailyTimer = null;
  weeklyTimer = null;
  started = false;
}

export { runDailyAlerts, runWeeklyAlerts };

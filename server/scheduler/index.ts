/**
 * Scheduler entry point — Phase 3 of operational-actions framework.
 *
 * Uses self-rescheduling setTimeout instead of node-cron so we avoid the
 * dependency. Four jobs:
 *   - daily 6 AM (Asia/Manila)   → runDailyAlerts() — MGMT inbox alerts +
 *                                   Caraga DOH news scrape
 *   - daily 8 AM (Asia/Manila)   → runDotsReminders() — DOTS visit SMS
 *                                   reminders to consenting TB patients.
 *                                   Deliberately outside the 21:00-07:00
 *                                   quiet-hours window enforced by
 *                                   shared/sms-policy.ts.
 *   - monthly 1st 5 AM Manila    → runM1MonthlyBootstrap() — creates the
 *                                   previous-month M1 report instance for
 *                                   every active barangay. TLs never have
 *                                   to click "Create Report" again.
 *   - Friday 4 PM (Asia/Manila)  → runWeeklyAlerts() — PIDSR cutoff check
 *
 * The scheduler is idempotent + best-effort. If the process restarts mid-day
 * we don't try to "catch up" — we just run on the next configured slot. An
 * admin can fire jobs manually via POST /api/admin/run-scheduler-now.
 */

import {
  runDailyAlerts,
  runDotsReminders,
  runM1MonthlyBootstrap,
  runWeeklyAlerts,
} from "./jobs";

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

/** Returns ms until the next 1st of month at hour:minute Manila time. */
function msUntilNextMonthStart(hourManila: number, minuteManila = 0): number {
  const now = new Date();
  const nowManila = new Date(now.getTime() + MANILA_OFFSET_HOURS * 3600 * 1000);
  const target = new Date(nowManila);
  target.setUTCDate(1);
  target.setUTCHours(hourManila, minuteManila, 0, 0);
  if (target <= nowManila) {
    // Already past this month's 1st — schedule for next month.
    target.setUTCMonth(target.getUTCMonth() + 1);
  }
  return target.getTime() - nowManila.getTime();
}

let dailyTimer: NodeJS.Timeout | null = null;
let smsTimer: NodeJS.Timeout | null = null;
let monthlyTimer: NodeJS.Timeout | null = null;
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

function scheduleDotsReminders() {
  const ms = msUntilNext(8, 0); // 8:00 AM Manila — well clear of quiet hours
  console.log(`[scheduler] next DOTS reminders run in ${Math.round(ms / 60000)} minutes`);
  smsTimer = setTimeout(async () => {
    console.log("[scheduler] running DOTS reminders");
    try {
      await runDotsReminders();
    } catch (err) {
      console.error("[scheduler] DOTS reminders run failed:", err);
    }
    scheduleDotsReminders();
  }, ms);
}

function scheduleM1MonthlyBootstrap() {
  const ms = msUntilNextMonthStart(5, 0); // 1st of month, 05:00 Manila
  const hours = Math.round(ms / 3600000);
  console.log(`[scheduler] next M1 monthly bootstrap in ${hours} hours`);
  monthlyTimer = setTimeout(async () => {
    console.log("[scheduler] running M1 monthly bootstrap");
    try {
      await runM1MonthlyBootstrap();
    } catch (err) {
      console.error("[scheduler] M1 bootstrap run failed:", err);
    }
    scheduleM1MonthlyBootstrap();
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
  scheduleDotsReminders();
  scheduleM1MonthlyBootstrap();
  scheduleWeekly();
  console.log(
    "[scheduler] started — daily 6 AM + 8 AM SMS + monthly-1st 5 AM M1 + Friday 4 PM (Asia/Manila)",
  );
}

export function stopScheduler(): void {
  if (dailyTimer) clearTimeout(dailyTimer);
  if (smsTimer) clearTimeout(smsTimer);
  if (monthlyTimer) clearTimeout(monthlyTimer);
  if (weeklyTimer) clearTimeout(weeklyTimer);
  dailyTimer = null;
  smsTimer = null;
  monthlyTimer = null;
  weeklyTimer = null;
  started = false;
}

export { runDailyAlerts, runDotsReminders, runM1MonthlyBootstrap, runWeeklyAlerts };

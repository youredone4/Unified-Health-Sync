/**
 * SMS send-time policy: quiet hours + per-barangay rate limits.
 *
 * Used by the SMS endpoint (server) and the future auto-SMS scheduler
 * job. Manual sends initiated by a clinician bypass both guards —
 * clinical judgement overrides automation policy.
 *
 * Pure functions / constants only. No I/O. Safe to import from any
 * layer (the rate-limit math takes a count provided by the caller).
 */

// ─── Quiet hours ─────────────────────────────────────────────────────

/**
 * Inclusive lower bound (start of "may send" window) in 24-hour Manila
 * time. SMS is allowed AT or AFTER this hour.
 */
export const QUIET_HOURS_START = 21; // 9 PM Manila — go quiet at 21:00
export const QUIET_HOURS_END = 7;    // 7 AM Manila — wake up at 07:00

/** Manila is UTC+8. No DST in PH; constant offset is safe. */
const MANILA_OFFSET_HOURS = 8;

/** Returns Manila wall-clock hour (0-23) for the given Date. */
function manilaHour(now: Date): number {
  const manila = new Date(now.getTime() + MANILA_OFFSET_HOURS * 3600 * 1000);
  return manila.getUTCHours();
}

/**
 * True when the given moment is inside the quiet-hours window
 * (21:00 ≤ hour OR hour < 07:00 Manila).
 *
 * Automated SMS sends during this window are deferred to the next
 * 07:00 Manila tick.
 */
export function isWithinQuietHours(now: Date = new Date()): boolean {
  const h = manilaHour(now);
  return h >= QUIET_HOURS_START || h < QUIET_HOURS_END;
}

/** Human-readable label for the quiet-hours window, for UI / logs. */
export const QUIET_HOURS_LABEL = "9 PM – 7 AM Manila";

// ─── Per-barangay rate limit ─────────────────────────────────────────

/**
 * Default cap on automated SMS per barangay per 24-hour rolling window.
 *
 * Operationally calibrated to typical BHS patient lists (≤50 active
 * TB patients, similar maternal / child / senior worklists). 100 is
 * roughly "double the largest realistic single-day batch" so a clean
 * run isn't artificially capped, but a runaway loop or bad query is
 * caught before it blows through Semaphore credits.
 *
 * Override via env: SMS_DAILY_LIMIT_PER_BARANGAY.
 */
export const SMS_DAILY_LIMIT_DEFAULT = 100;

export function getSmsDailyLimit(): number {
  const raw = process.env.SMS_DAILY_LIMIT_PER_BARANGAY;
  if (!raw) return SMS_DAILY_LIMIT_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return SMS_DAILY_LIMIT_DEFAULT;
  return Math.min(parsed, 1000);   // hard ceiling — protect against typo
}

/**
 * Compute whether sending one more SMS in `barangay` would breach the
 * daily limit. Pure: caller supplies the existing count (typically a
 * SELECT COUNT(*) from sms_outbox where barangay=$1 AND sentAt within
 * the last 24 hours).
 */
export function wouldExceedRateLimit(
  currentCount: number,
  limit: number = getSmsDailyLimit(),
): boolean {
  return currentCount >= limit;
}

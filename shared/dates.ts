/**
 * Calendar dates for HealthSync.
 *
 * Health records are dated by the PHILIPPINE calendar day: a child weighed
 * at 7 AM on the 21st in Placer was weighed on the 21st. Computers keep
 * time in UTC, which is 8 hours behind, so the common shortcut
 *
 *     new Date().toISOString().slice(0, 10)
 *
 * returns YESTERDAY for every record made before 8 AM. This module is the
 * one place that turns "now" into a Philippine date, on the server and in
 * the browser alike.
 *
 * Dates are plain "YYYY-MM-DD" strings. Arithmetic on them (add days, find
 * the Monday) is done on the calendar, with no time zone involved, so it
 * gives the same answer wherever the code runs.
 */

export const APP_TIME_ZONE = "Asia/Manila";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Philippine calendar date ("YYYY-MM-DD") of an instant. Defaults to now. */
export function manilaDate(instant: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD; formatToParts avoids relying on that.
  const parts = formatter.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's date in the Philippines. */
export function todayManila(): string {
  return manilaDate(new Date());
}

function toUtcMidnight(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function fromUtcMidnight(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `date` moved by `days` calendar days (negative goes back). */
export function addDays(date: string, days: number): string {
  const d = toUtcMidnight(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcMidnight(d);
}

/** The date `days` days before today in the Philippines. */
export function daysAgoManila(days: number): string {
  return addDays(todayManila(), -days);
}

/** The date `days` days after today in the Philippines. */
export function daysFromNowManila(days: number): string {
  return addDays(todayManila(), days);
}

/** Day of the week of a date: 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(date: string): number {
  return toUtcMidnight(date).getUTCDay();
}

/** Monday, Friday and Sunday of the ISO week (Monday-first) containing `date`. */
export function isoWeekBounds(date: string = todayManila()): { monday: string; friday: string; sunday: string } {
  const monday = addDays(date, -((weekdayOf(date) + 6) % 7));
  return { monday, friday: addDays(monday, 4), sunday: addDays(monday, 6) };
}

/** First day of the month containing `date`. */
export function monthStartOf(date: string = todayManila()): string {
  return `${date.slice(0, 7)}-01`;
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMidnight(to).getTime() - toUtcMidnight(from).getTime()) / 86_400_000);
}

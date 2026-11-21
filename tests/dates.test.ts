/**
 * Unit tests for shared/dates.ts. No server or database needed:
 *
 *   npm run test:unit
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  manilaDate, addDays, weekdayOf, isoWeekBounds, monthStartOf, daysBetween, todayManila, daysAgoManila,
} from "../shared/dates";

test("an instant is dated by the Philippine calendar, not UTC", () => {
  // 7:30 AM on 21 Nov in Manila is still 20 Nov, 23:30 in UTC.
  const earlyMorning = new Date("2026-11-20T23:30:00Z");
  assert.equal(earlyMorning.toISOString().slice(0, 10), "2026-11-20", "the UTC shortcut says yesterday");
  assert.equal(manilaDate(earlyMorning), "2026-11-21");

  assert.equal(manilaDate(new Date("2026-11-21T15:59:59Z")), "2026-11-21", "11:59 PM Manila");
  assert.equal(manilaDate(new Date("2026-11-21T16:00:00Z")), "2026-11-22", "midnight Manila");
  assert.equal(manilaDate(new Date("2026-12-31T16:00:00Z")), "2027-01-01", "new year arrives 8 hours early");
  assert.equal(manilaDate(new Date("2028-02-28T16:00:00Z")), "2028-02-29", "leap day");
});

test("the answer does not depend on the computer's own time zone", () => {
  const instant = new Date("2026-11-20T23:30:00Z");
  const original = process.env.TZ;
  try {
    for (const tz of ["UTC", "Asia/Manila", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = tz;
      assert.equal(manilaDate(instant), "2026-11-21", `process TZ=${tz}`);
      assert.equal(addDays("2026-03-01", -1), "2026-02-28", `addDays under TZ=${tz}`);
      assert.deepEqual(isoWeekBounds("2026-11-21"), { monday: "2026-11-16", friday: "2026-11-20", sunday: "2026-11-22" }, `week under TZ=${tz}`);
    }
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});

test("today and N-days-ago are consistent with each other", () => {
  const today = todayManila();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(daysAgoManila(0), today);
  assert.equal(daysBetween(daysAgoManila(7), today), 7);
});

test("calendar arithmetic crosses months, years and leap days", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2027-03-01", -1), "2027-02-28");
  assert.equal(addDays("2026-11-21", -90), "2026-08-23");
  assert.equal(addDays("2026-11-21", 0), "2026-11-21");
  assert.equal(daysBetween("2026-11-21", "2026-11-14"), -7);
  assert.equal(daysBetween("2026-01-01", "2027-01-01"), 365);
});

test("weeks start on Monday", () => {
  assert.equal(weekdayOf("2026-11-21"), 6, "21 Nov 2026 is a Saturday");
  assert.equal(weekdayOf("2026-11-22"), 0, "Sunday");
  // Monday itself, mid-week, and Sunday (which belongs to the week that started six days earlier).
  assert.deepEqual(isoWeekBounds("2026-11-16"), { monday: "2026-11-16", friday: "2026-11-20", sunday: "2026-11-22" });
  assert.deepEqual(isoWeekBounds("2026-11-18"), { monday: "2026-11-16", friday: "2026-11-20", sunday: "2026-11-22" });
  assert.deepEqual(isoWeekBounds("2026-11-22"), { monday: "2026-11-16", friday: "2026-11-20", sunday: "2026-11-22" });
  assert.deepEqual(isoWeekBounds("2027-01-01"), { monday: "2026-12-28", friday: "2027-01-01", sunday: "2027-01-03" }, "week spanning the new year");
});

test("month start", () => {
  assert.equal(monthStartOf("2026-11-21"), "2026-11-01");
  assert.equal(monthStartOf("2026-11-01"), "2026-11-01");
});

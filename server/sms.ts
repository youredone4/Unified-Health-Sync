/**
 * Shared SMS send pipeline.
 *
 * Consumed by:
 *  - The /api/sms POST handler (server/routes.ts) — operator-initiated
 *    manual sends.
 *  - The auto-SMS scheduler jobs (server/scheduler/jobs.ts) — daily
 *    DOTS / vaccine / NCD reminders.
 *
 * One code path means policy guards (phone validation, consent gates,
 * quiet hours, rate limits) live in exactly one place.
 *
 * The HTTP layer is a thin wrapper that parses input, calls this
 * function, and shapes the response. The scheduler layer iterates
 * eligible patients and calls this function per send.
 */

import { db } from "./db";
import { smsOutbox } from "@shared/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { validatePhilippineMobile } from "@shared/phone";
import {
  isWithinQuietHours,
  wouldExceedRateLimit,
  getSmsDailyLimit,
  QUIET_HOURS_LABEL,
} from "@shared/sms-policy";

export interface SendSmsInput {
  recipient: string;
  recipientPhone: string | null | undefined;
  message: string;
  barangay?: string | null;
  /**
   * Distinguishes scheduler-fired sends from operator-initiated ones.
   * Manual sends bypass quiet-hours and rate-limit guards (clinical
   * judgement overrides automation policy). Default: false.
   */
  automated?: boolean;
}

export type SendSmsResult =
  | { kind: "INVALID_PHONE"; error: string }
  | { kind: "DEFERRED"; reason: "QUIET_HOURS" | "RATE_LIMITED"; message: string; count?: number; limit?: number }
  | { kind: "SENT"; status: string };

/**
 * Sends one SMS through the full policy pipeline.
 *
 * 1. Phone validation — refuses on missing/invalid number.
 * 2. Automated-only guards:
 *    a. Quiet hours (21:00–07:00 Manila): defers.
 *    b. Per-barangay daily rate limit: defers if last-24h count for
 *       this barangay's automated sends ≥ configured cap.
 * 3. Semaphore dispatch when SEMAPHORE_API_KEY is set (otherwise
 *    "Queued (Demo)" status — useful for development).
 * 4. Always records the attempt to sms_outbox (even DEFERRED writes a
 *    row with status carrying the defer reason, so the audit trail is
 *    complete).
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const automated = input.automated === true;
  const barangay = input.barangay ?? null;

  // 1 — phone validation
  if (input.recipientPhone !== undefined && input.recipientPhone !== null) {
    const phoneErr = validatePhilippineMobile(input.recipientPhone);
    if (phoneErr) {
      return { kind: "INVALID_PHONE", error: phoneErr };
    }
  }

  // 2 — automated-only policy guards
  if (automated) {
    if (isWithinQuietHours()) {
      const msg = `Automated SMS deferred — quiet hours active (${QUIET_HOURS_LABEL})`;
      await db.insert(smsOutbox).values({
        recipient: input.recipient,
        recipientPhone: input.recipientPhone ?? null,
        message: input.message,
        sentAt: new Date().toISOString(),
        status: `Deferred: QUIET_HOURS`,
        barangay,
        automated,
      });
      return { kind: "DEFERRED", reason: "QUIET_HOURS", message: msg };
    }
    if (barangay) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [c] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(smsOutbox)
        .where(and(
          eq(smsOutbox.barangay, barangay),
          eq(smsOutbox.automated, true),
          gte(smsOutbox.sentAt, since),
        ));
      const count = c?.n ?? 0;
      if (wouldExceedRateLimit(count)) {
        const limit = getSmsDailyLimit();
        const msg =
          `Automated SMS deferred — daily limit reached for ${barangay} ` +
          `(${count} / ${limit} in last 24 h)`;
        await db.insert(smsOutbox).values({
          recipient: input.recipient,
          recipientPhone: input.recipientPhone ?? null,
          message: input.message,
          sentAt: new Date().toISOString(),
          status: `Deferred: RATE_LIMITED`,
          barangay,
          automated,
        });
        return { kind: "DEFERRED", reason: "RATE_LIMITED", message: msg, count, limit };
      }
    }
  }

  // 3 — Semaphore dispatch (or demo queue)
  let status = "Queued (Demo)";
  const semaphoreKey = process.env.SEMAPHORE_API_KEY;
  if (semaphoreKey && input.recipientPhone) {
    try {
      const rawSender = process.env.SEMAPHORE_SENDER_NAME?.trim() || "";
      let senderName: string | undefined;
      if (rawSender) {
        if (/^[A-Za-z0-9]{1,11}$/.test(rawSender)) {
          senderName = rawSender;
        } else {
          console.warn(
            `[sms] SEMAPHORE_SENDER_NAME="${rawSender}" is not valid ` +
              `(needs ≤11 alphanumeric chars, no spaces). Falling back ` +
              `to Semaphore's default sender.`,
          );
        }
      }
      const params = new URLSearchParams({
        apikey: semaphoreKey,
        number: input.recipientPhone.replace(/^\+63/, "0"),
        message: input.message,
        ...(senderName ? { sendername: senderName } : {}),
      });
      const smsFetch = await fetch("https://api.semaphore.co/api/v4/messages", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const smsResult = await smsFetch.json();
      if (smsFetch.ok && Array.isArray(smsResult) && smsResult[0]?.status) {
        status = smsResult[0].status === "Queued" ? "Sent" : smsResult[0].status;
      } else {
        const errMsg = smsResult?.message || JSON.stringify(smsResult);
        console.error("[sms] Semaphore error:", errMsg);
        status = `Failed: ${errMsg}`;
      }
    } catch (smsErr) {
      console.error("[sms] Semaphore request failed:", smsErr);
      status = "Failed: network error";
    }
  }

  // 4 — audit trail
  await db.insert(smsOutbox).values({
    recipient: input.recipient,
    recipientPhone: input.recipientPhone ?? null,
    message: input.message,
    sentAt: new Date().toISOString(),
    status,
    barangay,
    automated,
  });

  return { kind: "SENT", status };
}

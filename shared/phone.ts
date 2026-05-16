/**
 * Philippine mobile-number validation + normalization.
 *
 * Single source of truth used by:
 *  - client/src/components/sms-modal.tsx (pre-send UI check)
 *  - server/routes.ts SMS endpoint (defense-in-depth check)
 *  - any future auto-SMS scheduler job (must not blast bad numbers)
 *  - patient profiles (visible "phone needs update" flag)
 *
 * Accepted input formats:
 *  - 09171234567        (local, 11 digits, starts with 09)
 *  - +639171234567      (international, +63 then 10 digits starting with 9)
 *  - 639171234567       (international without the +)
 *  - With or without spaces/dashes, which are stripped before checking.
 *
 * Output:
 *  - normalize() → canonical "+639XXXXXXXXX" or null if invalid
 *  - validate()  → null if valid, error message string if not
 *  - isValid()   → boolean shorthand
 *
 * Pure functions. No I/O. Safe to import from any layer.
 */

const STRIP_RE = /[\s\-()]/g;

/** Strip whitespace + punctuation users tend to include. */
function clean(raw: string): string {
  return raw.replace(STRIP_RE, "").trim();
}

/**
 * Canonicalize a phone number to "+639XXXXXXXXX" form, or return null
 * if it can't be coerced to that shape.
 */
export function normalizePhilippineMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = clean(raw);
  if (!c) return null;

  // 09171234567 → 9171234567 → +639171234567
  if (/^09\d{9}$/.test(c)) {
    return "+63" + c.substring(1);
  }
  // +639171234567 → +639171234567
  if (/^\+639\d{9}$/.test(c)) {
    return c;
  }
  // 639171234567 → +639171234567
  if (/^639\d{9}$/.test(c)) {
    return "+" + c;
  }
  return null;
}

/**
 * Returns null if the number is a valid PH mobile, or a human-readable
 * error message if not. Use this for UI form errors.
 */
export function validatePhilippineMobile(raw: string | null | undefined): string | null {
  if (!raw || !clean(raw)) {
    return "Phone number is required.";
  }
  if (normalizePhilippineMobile(raw) === null) {
    return "Enter a valid Philippine mobile number (e.g. 09171234567 or +639171234567).";
  }
  return null;
}

/** Boolean shorthand for predicate use (status pills, filtering). */
export function isValidPhilippineMobile(raw: string | null | undefined): boolean {
  return normalizePhilippineMobile(raw) !== null;
}

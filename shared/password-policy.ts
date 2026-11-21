/**
 * Password policy — shared by the server (enforcement) and the client
 * (inline hints). The server is the authority; the client check only saves
 * a round trip.
 *
 * Follows NIST SP 800-63B: length matters most, no forced character mixes,
 * and reject passwords that are known to be common or that were ever a
 * built-in default of this system.
 */

export const PASSWORD_MIN_LENGTH = 12;
// bcrypt only hashes the first 72 bytes; refuse anything longer rather than
// silently ignoring the tail.
export const PASSWORD_MAX_BYTES = 72;

/**
 * Passwords that shipped as built-in defaults in earlier versions of
 * HealthSync. An account still using one is refused at login outright (see
 * server/auth.ts) because the value is public knowledge.
 */
export const KNOWN_DEFAULT_PASSWORDS: readonly string[] = ["admin123", "123456"];

// Lower-cased. Deliberately short: the length rule already removes most of
// the classic list, so this only needs the long-enough offenders plus the
// obvious local guesses.
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "123456789012", "1234567890123", "12345678901234", "123456789abc", "1234567890ab",
  "111111111111", "000000000000", "121212121212", "123123123123", "abc123abc123",
  "qwertyuiop12", "qwertyuiop123", "qwerty123456", "qwertyqwerty", "1q2w3e4r5t6y",
  "1qaz2wsx3edc", "zaq12wsx3edc", "asdfghjkl123", "asdfghjkl1234", "zxcvbnm12345",
  "password1234", "password12345", "password123456", "passwordpassword", "passw0rd1234",
  "p@ssw0rd1234", "p@ssword1234", "mypassword123", "newpassword123", "changeme1234",
  "changeme12345", "letmein12345", "welcome12345", "welcome123456", "iloveyou1234",
  "iloveyou12345", "administrator", "administrator1", "admin1234567", "admin12345678",
  "adminadmin123", "healthsync123", "healthsync1234", "healthsync2024", "healthsync2025",
  "healthsync2026", "geohealthsync", "geohealthsync1", "placer123456", "placer1234567",
  "surigao123456", "surigaodelnorte", "barangay1234", "barangay12345", "municipality1",
  "philippines12", "philippines123", "pilipinas1234", "mahalkita1234", "mahalkita12345",
]);

export interface PasswordCheck {
  ok: boolean;
  /** Human-readable reason when ok is false. */
  message?: string;
}

function utf8ByteLength(value: string): number {
  // TextEncoder exists in both browsers and Node.
  return new TextEncoder().encode(value).length;
}

export function isKnownDefaultPassword(password: string): boolean {
  return KNOWN_DEFAULT_PASSWORDS.includes(password);
}

/**
 * Validate a NEW password. `username` (and optional name parts) are used to
 * reject passwords built from the account's own identity.
 */
export function checkPassword(
  password: unknown,
  context: { username?: string | null; firstName?: string | null; lastName?: string | null } = {},
): PasswordCheck {
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, message: "Password is required." };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (utf8ByteLength(password) > PASSWORD_MAX_BYTES) {
    return { ok: false, message: `Password is too long (maximum ${PASSWORD_MAX_BYTES} characters).` };
  }

  const lower = password.toLowerCase();
  if (isKnownDefaultPassword(password) || COMMON_PASSWORDS.has(lower)) {
    return { ok: false, message: "That password is too common. Choose something harder to guess." };
  }
  // One character repeated, e.g. "aaaaaaaaaaaa".
  if (new Set(lower).size < 4) {
    return { ok: false, message: "Password is too repetitive. Use a mix of different characters." };
  }

  const identityParts = [context.username, context.firstName, context.lastName]
    .map((part) => (part ?? "").trim().toLowerCase())
    .filter((part) => part.length >= 4);
  if (identityParts.some((part) => lower.includes(part))) {
    return { ok: false, message: "Password must not contain your username or name." };
  }

  return { ok: true };
}

export const PASSWORD_RULES_SUMMARY =
  `At least ${PASSWORD_MIN_LENGTH} characters. A short sentence or a few unrelated words works well. ` +
  "Don't use your name, username, or a common password.";

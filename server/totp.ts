/**
 * Two-step sign-in primitives: time-based one-time passwords (TOTP,
 * RFC 6238 — what Google Authenticator, Microsoft Authenticator, Authy and
 * similar apps implement), recovery codes, and encryption of the shared
 * secret at rest.
 *
 * No Express or database imports: everything here is a pure function, and
 * tests/totp.test.ts checks it against the RFC's published test vectors.
 */
import crypto from "crypto";

// --- Base32 (RFC 4648), the encoding authenticator apps expect -------------

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// --- TOTP --------------------------------------------------------------------

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
// Accept the previous and next 30-second window as well, to tolerate a
// phone clock that is slightly off.
const TOTP_WINDOW = 1;

/** A new random 160-bit secret, base32-encoded (32 characters). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

/** The code for one specific 30-second step (HOTP, RFC 4226, with SHA-1). */
export function totpCode(secretBase32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac("sha1", base32Decode(secretBase32)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Checks a submitted code. Returns the time step it matched, or null.
 *
 * `lastUsedStep` makes each code single-use: a code is refused if its step
 * is not later than the last one accepted for this account, so a code that
 * was watched or intercepted cannot be replayed within its 30-90 seconds.
 */
export function verifyTotp(
  secretBase32: string,
  submitted: string,
  lastUsedStep: number | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  const code = submitted.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const current = totpStep(nowMs);
  let matched: number | null = null;
  // Check every candidate (no early exit) so timing does not depend on
  // which window matched.
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset++) {
    const step = current + offset;
    if (safeEqual(totpCode(secretBase32, step), code) && step > (lastUsedStep ?? -1)) {
      matched = matched === null ? step : Math.max(matched, step);
    }
  }
  return matched;
}

/** The otpauth:// URI an authenticator app reads from the QR code. */
export function otpauthUrl(secretBase32: string, accountName: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// --- Secret encryption at rest -----------------------------------------------
//
// The TOTP secret has to be recoverable (the server recomputes codes from
// it), so it cannot be hashed like a password. It is encrypted with a key
// that lives in the server's configuration, not in the database: a leaked
// database or backup alone does not reveal it.

function deriveKey(keyMaterial: string): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", keyMaterial, "healthsync", "totp-secret-v1", 32));
}

export function encryptSecret(plain: string, keyMaterial: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(keyMaterial), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Throws if the value was tampered with or the key is not the one that encrypted it. */
export function decryptSecret(stored: string, keyMaterial: string): string {
  const [version, iv, tag, ciphertext] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Unrecognised secret format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(keyMaterial), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

// --- Recovery codes ----------------------------------------------------------

// No look-alike characters; these get written down by hand.
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 10;

/** Ten single-use codes like "K7QM2-X9PRT" (about 50 bits each). */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  while (codes.length < count) {
    let raw = "";
    while (raw.length < 10) {
      const byte = crypto.randomBytes(1)[0];
      if (byte < 256 - (256 % RECOVERY_ALPHABET.length)) raw += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
    }
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function normaliseRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Recovery codes are random and long, so a plain SHA-256 is an adequate hash. */
export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(normaliseRecoveryCode(code)).digest("hex");
}

export function looksLikeRecoveryCode(input: string): boolean {
  return normaliseRecoveryCode(input).length === 10 && !/^\d{6}$/.test(input.replace(/\s/g, ""));
}

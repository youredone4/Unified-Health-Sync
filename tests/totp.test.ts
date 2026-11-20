/**
 * Unit tests for server/totp.ts. No server or database needed:
 *
 *   npm run test:unit
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  base32Encode, base32Decode, totpCode, totpStep, verifyTotp, generateTotpSecret, otpauthUrl,
  encryptSecret, decryptSecret, generateRecoveryCodes, hashRecoveryCode, looksLikeRecoveryCode,
} from "../server/totp";

// RFC 6238 Appendix B, SHA-1 rows. The RFC lists 8-digit codes; a 6-digit
// code is the last six digits of the same value.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
const RFC_VECTORS: Array<[seconds: number, code8: string]> = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

test("TOTP matches the RFC 6238 test vectors", () => {
  for (const [seconds, code8] of RFC_VECTORS) {
    assert.equal(totpCode(RFC_SECRET, totpStep(seconds * 1000)), code8.slice(2), `at t=${seconds}`);
  }
});

test("base32 round-trips and matches a known value", () => {
  assert.equal(base32Encode(Buffer.from("foobar")), "MZXW6YTBOI");
  assert.equal(base32Decode("MZXW6YTBOI").toString(), "foobar");
  assert.equal(base32Decode("mzxw 6ytb oi==").toString(), "foobar", "tolerates case, spaces and padding");
  const random = Buffer.from(Array.from({ length: 20 }, (_, i) => (i * 37) % 256));
  assert.deepEqual(base32Decode(base32Encode(random)), random);
  assert.throws(() => base32Decode("not!base32"));
});

test("a generated secret is 160 bits of base32", () => {
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.equal(base32Decode(secret).length, 20);
  assert.notEqual(secret, generateTotpSecret());
});

test("verify accepts the current and adjacent windows only", () => {
  const now = 1_700_000_000_000;
  const step = totpStep(now);
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), null, now), step);
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), null, now), step - 1);
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), null, now), step + 1);
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), null, now), null);
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 2), null, now), null);
});

test("verify rejects malformed input", () => {
  for (const bad of ["", "12345", "1234567", "abcdef", "12 34 5", "000000 OR 1=1"]) {
    assert.equal(verifyTotp(RFC_SECRET, bad, null), null, JSON.stringify(bad));
  }
  const now = 1_700_000_000_000;
  const good = totpCode(RFC_SECRET, totpStep(now));
  assert.notEqual(verifyTotp(RFC_SECRET, `${good.slice(0, 3)} ${good.slice(3)}`, null, now), null, "a space in the middle is fine");
});

test("a code cannot be used twice", () => {
  const now = 1_700_000_000_000;
  const step = totpStep(now);
  const code = totpCode(RFC_SECRET, step);
  assert.equal(verifyTotp(RFC_SECRET, code, null, now), step);
  assert.equal(verifyTotp(RFC_SECRET, code, step, now), null, "same step again");
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), step, now), null, "an older step after a newer one");
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), step, now), step + 1, "the next step still works");
});

test("otpauth URL carries the secret, issuer and account", () => {
  const url = new URL(otpauthUrl(RFC_SECRET, "nurse.maria", "HealthSync Placer"));
  assert.equal(url.protocol, "otpauth:");
  assert.equal(url.searchParams.get("secret"), RFC_SECRET);
  assert.equal(url.searchParams.get("issuer"), "HealthSync Placer");
  assert.equal(url.host, "totp");
  assert.equal(decodeURIComponent(url.pathname), "/HealthSync Placer:nurse.maria");
});

test("secrets are encrypted with an authenticated cipher", () => {
  const key = "k".repeat(40);
  const stored = encryptSecret(RFC_SECRET, key);
  assert.ok(!stored.includes(RFC_SECRET));
  assert.equal(decryptSecret(stored, key), RFC_SECRET);
  assert.notEqual(encryptSecret(RFC_SECRET, key), stored, "fresh IV every time");
  assert.throws(() => decryptSecret(stored, "another-key".repeat(4)), "wrong key");
  const parts = stored.split(":");
  parts[3] = Buffer.from("tampered-ciphertext-value").toString("base64");
  assert.throws(() => decryptSecret(parts.join(":"), key), "tampered ciphertext");
  assert.throws(() => decryptSecret("garbage", key));
});

test("recovery codes are unique, formatted and matched loosely", () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) assert.match(c, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
  const [first] = codes;
  assert.equal(hashRecoveryCode(first), hashRecoveryCode(first.toLowerCase().replace("-", " ")));
  assert.notEqual(hashRecoveryCode(first), hashRecoveryCode(codes[1]));
  assert.equal(looksLikeRecoveryCode(first), true);
  assert.equal(looksLikeRecoveryCode("123456"), false);
});

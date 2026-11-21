/**
 * Password hashing and temporary-password generation.
 *
 * Kept free of Express / config imports so the admin CLI (script/admin.ts)
 * can use it without booting the web server's configuration.
 */
import bcrypt from "bcrypt";
import crypto from "crypto";

// bcrypt work factor. 12 ≈ 250 ms per hash on current server hardware:
// slow enough to make offline guessing expensive, fast enough for login.
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A valid hash of a random value nobody knows. Compared against when the
// username does not exist so a failed login takes the same time either way
// (otherwise response time reveals which usernames are real).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), SALT_ROUNDS);

export async function burnPasswordCheck(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}

/** True when a stored hash was made with a weaker work factor than today's. */
export function needsRehash(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) < SALT_ROUNDS;
  } catch {
    return false;
  }
}

// No look-alike characters (0/O, 1/l/I) — these get read out over the phone
// and typed from a slip of paper.
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * Random temporary password, e.g. "Xk7m-Qp3d-Wn8r-Tb5z". 16 random
 * characters ≈ 93 bits. Always issued with mustChangePassword = true.
 */
export function generateTemporaryPassword(): string {
  const chars: string[] = [];
  while (chars.length < 16) {
    const byte = crypto.randomBytes(1)[0];
    // Rejection sampling keeps the distribution uniform.
    if (byte < TEMP_ALPHABET.length * Math.floor(256 / TEMP_ALPHABET.length)) {
      chars.push(TEMP_ALPHABET[byte % TEMP_ALPHABET.length]);
    }
  }
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

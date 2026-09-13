import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

// NIST 800-63B guidance: length matters far more than forced character
// mixes (which push people toward predictable patterns like "Password1!").
// Block the most commonly breached/guessed passwords instead of requiring
// symbols/numbers. Swap in a longer real breach-list per project if you want
// stronger coverage — this is a minimal starter set.
const COMMON_PASSWORDS = new Set([
  'password123', 'password1234', 'password12345', 'passw0rd123',
  '123456789012', 'qwertyuiop12', 'qwerty123456', '1qaz2wsx3edc',
  'letmein12345', 'welcome12345', 'iloveyou1234', 'admin12345678',
  'dragon123456', 'monkey123456', 'football1234', 'baseball1234',
  'trustno1trustno1', 'sunshine1234', 'princess1234', 'superman1234',
  'aaaaaaaaaaaa', '111111111111', '000000000000', 'abcdefghijkl',
  'abc123abc123', 'changeme1234', 'temppassword', 'temporarypass',
]);

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH || password.length > MAX_LENGTH) return false;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return false;
  return true;
}

export function validateEmail(email) {
  if (typeof email !== 'string' || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// What-if: caller passes a non-string, empty, or oversized password to hash —
// reject before it ever reaches bcrypt instead of hashing garbage.
export async function hashPassword(password) {
  if (!validatePassword(password)) {
    throw new Error(`Password must be ${MIN_LENGTH}-${MAX_LENGTH} characters.`);
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

// What-if: hash is missing/null (e.g. OAuth-only account) — compare against
// nothing rather than throwing, so callers get a clean false instead of a crash.
export async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || !password || typeof hash !== 'string' || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

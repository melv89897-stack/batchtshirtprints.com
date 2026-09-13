import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
// Test runner points this at a throwaway file so automated tests never touch
// the real dev database.
const DB_PATH = process.env.BATCH_TEST_DB_PATH || path.join(DATA_DIR, 'batch.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'none',
    email_verified INTEGER DEFAULT 0,
    failed_logins INTEGER DEFAULT 0,
    locked_until TEXT,
    token_version INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS usage (
    user_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    prints_used INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, month_key)
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'signup',
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (email, type)
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS processed_webhook_events (
    event_id TEXT PRIMARY KEY,
    processed_at TEXT NOT NULL
  );
`);

// ── Helpers ──────────────────────────────────────────────────────────────────

export function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    plan: row.plan,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    subscriptionStatus: row.subscription_status || 'none',
    emailVerified: !!row.email_verified,
    createdAt: row.created_at,
  };
}

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Prepared statements ──────────────────────────────────────────────────────

const stmts = {
  insertUser: db.prepare(`
    INSERT INTO users (id, email, name, password_hash, plan, created_at, updated_at)
    VALUES (@id, @email, @name, @password_hash, @plan, @created_at, @updated_at)
  `),
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  updateUser: db.prepare(`
    UPDATE users SET
      name = COALESCE(@name, name),
      plan = COALESCE(@plan, plan),
      stripe_customer_id = COALESCE(@stripe_customer_id, stripe_customer_id),
      stripe_subscription_id = COALESCE(@stripe_subscription_id, stripe_subscription_id),
      subscription_status = COALESCE(@subscription_status, subscription_status),
      email_verified = COALESCE(@email_verified, email_verified),
      failed_logins = COALESCE(@failed_logins, failed_logins),
      locked_until = COALESCE(@locked_until, locked_until),
      password_hash = COALESCE(@password_hash, password_hash),
      updated_at = @updated_at
    WHERE id = @id
  `),
  incFailedLogins: db.prepare(`
    UPDATE users SET
      failed_logins = failed_logins + 1,
      locked_until = CASE WHEN failed_logins + 1 >= 5 THEN @locked_until ELSE locked_until END,
      updated_at = @now
    WHERE email = ?
  `),
  resetLogins: db.prepare(`
    UPDATE users SET failed_logins = 0, locked_until = NULL, updated_at = @now WHERE email = ?
  `),
  findByStripeCustomer: db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?'),
  allUsers: db.prepare('SELECT * FROM users ORDER BY created_at DESC'),

  getUsage: db.prepare('SELECT * FROM usage WHERE user_id = ? AND month_key = ?'),
  upsertUsage: db.prepare(`
    INSERT INTO usage (user_id, month_key, prints_used)
    VALUES (@user_id, @month_key, 0)
    ON CONFLICT (user_id, month_key) DO NOTHING
  `),
  addPrints: db.prepare('UPDATE usage SET prints_used = prints_used + ? WHERE user_id = ? AND month_key = ?'),

  upsertCode: db.prepare(`
    INSERT OR REPLACE INTO verification_codes (email, code, user_id, type, expires_at)
    VALUES (@email, @code, @user_id, @type, @expires_at)
  `),
  getCode: db.prepare('SELECT * FROM verification_codes WHERE email = ? AND type = ?'),
  deleteCode: db.prepare('DELETE FROM verification_codes WHERE email = ? AND type = ?'),

  insertReset: db.prepare(`
    INSERT INTO password_resets (token, user_id, expires_at) VALUES (@token, @user_id, @expires_at)
  `),
  getReset: db.prepare('SELECT * FROM password_resets WHERE token = ?'),
  markResetUsed: db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?'),
  cleanupResets: db.prepare('DELETE FROM password_resets WHERE expires_at < ? OR used = 1'),

  getWebhookEvent: db.prepare('SELECT event_id FROM processed_webhook_events WHERE event_id = ?'),
  insertWebhookEvent: db.prepare('INSERT INTO processed_webhook_events (event_id, processed_at) VALUES (?, ?)'),
};

// ── Users ────────────────────────────────────────────────────────────────────

export function createUser({ email, passwordHash, plan = 'free', name = '' }) {
  const existing = stmts.findByEmail.get(email);
  if (existing) return null;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  stmts.insertUser.run({ id, email, name, password_hash: passwordHash, plan, created_at: now, updated_at: now });
  return sanitizeUser(stmts.findById.get(id));
}

export function findUserByEmail(email) {
  return stmts.findByEmail.get(email) || null;
}

export function findUserById(id) {
  return stmts.findById.get(id) || null;
}

export function updateUser(id, updates) {
  const now = new Date().toISOString();
  stmts.updateUser.run({
    id,
    name: updates.name ?? null,
    plan: updates.plan ?? null,
    stripe_customer_id: updates.stripeCustomerId ?? null,
    stripe_subscription_id: updates.stripeSubscriptionId ?? null,
    subscription_status: updates.subscriptionStatus ?? null,
    email_verified: updates.emailVerified != null ? (updates.emailVerified ? 1 : 0) : null,
    failed_logins: updates.failedLogins ?? null,
    locked_until: updates.lockedUntil !== undefined ? (updates.lockedUntil || null) : null,
    password_hash: updates.passwordHash ?? null,
    updated_at: now,
  });
  return sanitizeUser(stmts.findById.get(id));
}

export function recordFailedLogin(email) {
  const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  stmts.incFailedLogins.run({ locked_until: lockUntil, now: new Date().toISOString() }, email);
}

export function resetFailedLogins(email) {
  stmts.resetLogins.run({ now: new Date().toISOString() }, email);
}

export function bumpTokenVersion(userId) {
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(userId);
  return findUserById(userId);
}

export function isAccountLocked(user) {
  if (!user.locked_until) return false;
  return new Date(user.locked_until) > new Date();
}

export function findUserByStripeCustomer(customerId) {
  return stmts.findByStripeCustomer.get(customerId) || null;
}

export function getAllUsers() {
  return stmts.allUsers.all().map(sanitizeUser);
}

// ── Usage / plan limits ──────────────────────────────────────────────────────

// Free/Starter/Pro tiers fixed by the product owner. maxPerBatch equals the
// plan's full monthly allowance — see PLAN.md for why a separate per-batch
// cap wasn't added on top of the monthly cap.
export const PLAN_LIMITS = {
  free:    { monthlyPrints: 10,   maxPerBatch: 10,   name: 'Free',    price: 0,   unlimited: false },
  starter: { monthlyPrints: 100,  maxPerBatch: 100,  name: 'Starter', price: 499, unlimited: false },
  pro:     { monthlyPrints: 1000, maxPerBatch: 1000, name: 'Pro',     price: 999, unlimited: false },
};

export function getUsage(userId) {
  const key = getMonthKey();
  const row = stmts.getUsage.get(userId, key);
  return { printsUsed: row?.prints_used || 0, monthKey: key };
}

export function incrementUsage(userId, count) {
  const key = getMonthKey();
  stmts.upsertUsage.run({ user_id: userId, month_key: key });
  stmts.addPrints.run(count, userId, key);
  return getUsage(userId);
}

// Atomically checks-and-reserves quota in one synchronous call. better-sqlite3
// is synchronous and Node is single-threaded, so as long as no `await`
// separates the read from the write, no concurrent request can interleave
// between them — see inkstorm/server/db.js reserveUsage() for the same
// reasoning; that project's fix for a real race is reused here verbatim.
export function reserveUsage(userId, plan, count) {
  const usage = getUsage(userId);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  if (usage.printsUsed + count > limits.monthlyPrints) return false;
  incrementUsage(userId, count);
  return true;
}

// ── Verification Codes ───────────────────────────────────────────────────────

export function saveVerificationCode(email, code, userId, type = 'signup') {
  stmts.upsertCode.run({
    email: email.toLowerCase().trim(),
    code,
    user_id: userId,
    type,
    expires_at: Date.now() + 10 * 60 * 1000,
  });
}

export function getVerificationCode(email, type = 'signup') {
  return stmts.getCode.get(email.toLowerCase().trim(), type) || null;
}

export function deleteVerificationCode(email, type = 'signup') {
  stmts.deleteCode.run(email.toLowerCase().trim(), type);
}

// ── Password Resets ──────────────────────────────────────────────────────────

export function createPasswordReset(userId) {
  stmts.cleanupResets.run(Date.now());
  const token = crypto.randomBytes(32).toString('hex');
  stmts.insertReset.run({ token, user_id: userId, expires_at: Date.now() + 60 * 60 * 1000 });
  return token;
}

export function getPasswordReset(token) {
  return stmts.getReset.get(token) || null;
}

export function markPasswordResetUsed(token) {
  stmts.markResetUsed.run(token);
}

// ── Webhook idempotency ──────────────────────────────────────────────────────

export function wasWebhookEventProcessed(eventId) {
  return !!stmts.getWebhookEvent.get(eventId);
}

export function markWebhookEventProcessed(eventId) {
  stmts.insertWebhookEvent.run(eventId, new Date().toISOString());
}

export { db };

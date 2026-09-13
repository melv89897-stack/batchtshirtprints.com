import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { hashPassword, verifyPassword, validateEmail, validatePassword } from './passwords.js';

/**
 * createAuthRouter(store, config) — plug-and-play signup/login/logout for any
 * Express app. `store` is the only thing you rewrite per project; everything
 * else (hashing, sessions, lockout, rate limiting) stays as-is.
 *
 * Required `store` methods (sync or async, all may return a Promise):
 *   findUserByEmail(email)              -> user | null
 *   findUserById(id)                    -> user | null
 *   createUser({ email, passwordHash, name }) -> user | null  (null = duplicate email)
 *   updateUser(id, updates)             -> user
 *   recordFailedLogin(email)            -> void
 *   resetFailedLogins(email)            -> void
 *   isAccountLocked(user)               -> boolean
 *   bumpTokenVersion(id)                -> user
 *   sanitizeUser(user)                  -> user object safe to send to the client (no password hash)
 *
 * `user` objects must expose `.id`, `.email`, and either `.passwordHash` or
 * `.password_hash`, plus `.tokenVersion` / `.token_version` (defaults to 0).
 *
 * Required `config`:
 *   jwtSecret   — long random string, e.g. `openssl rand -hex 64`. No fallback
 *                 is generated for you: a silently-generated secret would
 *                 invalidate every session on each server restart, which is
 *                 worse than failing loudly at startup.
 *
 * Optional `config`:
 *   cookieName        (default 'session')
 *   cookieSecure       (default: true when NODE_ENV === 'production')
 *   tokenExpiry        (default '7d')
 *   maxFailedAttempts  (default 5)
 *   lockoutMinutes     (default 15)
 */
export function createAuthRouter(store, config) {
  if (!config?.jwtSecret) {
    throw new Error(
      'createAuthRouter: config.jwtSecret is required. Generate one with `openssl rand -hex 64` and load it from an env var — never hardcode it.'
    );
  }

  const {
    jwtSecret,
    cookieName = 'session',
    cookieSecure = process.env.NODE_ENV === 'production',
    tokenExpiry = '7d',
    maxFailedAttempts = 5,
    lockoutMinutes = 15,
  } = config;

  const required = [
    'findUserByEmail', 'findUserById', 'createUser', 'updateUser',
    'recordFailedLogin', 'resetFailedLogins', 'isAccountLocked',
    'bumpTokenVersion', 'sanitizeUser',
  ];
  const missing = required.filter((fn) => typeof store?.[fn] !== 'function');
  if (missing.length) {
    throw new Error(`createAuthRouter: store is missing required method(s): ${missing.join(', ')}`);
  }

  const router = express.Router();

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const authSlowDown = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 3,
    delayMs: (hits) => (hits - 3) * 500,
  });

  function tokenVersionOf(user) {
    return user.tokenVersion ?? user.token_version ?? 0;
  }

  function passwordHashOf(user) {
    return user.passwordHash ?? user.password_hash ?? null;
  }

  function setSessionCookie(res, userId, tv) {
    const token = jwt.sign({ userId, tv }, jwtSecret, { expiresIn: tokenExpiry });
    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  function sanitize(s, max = 200) {
    return typeof s === 'string' ? s.replace(/[<>]/g, '').trim().slice(0, max) : '';
  }

  // ── Signup ───────────────────────────────────────────────────────────────

  router.post('/signup', authLimiter, authSlowDown, async (req, res) => {
    try {
      const { email, password, name } = req.body;

      // What-if: malformed email, weak password, or missing name — reject
      // before touching the store at all.
      if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email address.' });
      if (!validatePassword(password)) return res.status(400).json({ error: 'Password must be 12-128 characters and not a commonly used one.' });
      if (!name || sanitize(name).length < 1) return res.status(400).json({ error: 'Name is required.' });

      const normalized = email.toLowerCase().trim();

      // What-if: email already registered — don't let a second account overwrite it.
      const existing = await store.findUserByEmail(normalized);
      if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

      const passwordHash = await hashPassword(password);
      const user = await store.createUser({ email: normalized, passwordHash, name: sanitize(name) });

      // What-if: the store itself rejects creation for a reason not caught above
      // (e.g. a race between the check and the insert).
      if (!user) return res.status(500).json({ error: 'Failed to create account. Please try again.' });

      setSessionCookie(res, user.id, tokenVersionOf(user));
      res.status(201).json({ user: store.sanitizeUser(user) });
    } catch (err) {
      console.error('Signup error:', err.message);
      res.status(500).json({ error: 'Signup failed. Please try again.' });
    }
  });

  // ── Login ────────────────────────────────────────────────────────────────

  router.post('/login', authLimiter, authSlowDown, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

      const normalized = email.toLowerCase().trim();
      const user = await store.findUserByEmail(normalized);

      // What-if: unknown email — still run a hash so response timing doesn't
      // reveal whether the account exists.
      if (!user) {
        await hashPassword('placeholder-timing-guard');
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      // What-if: account is mid-lockout from prior failed attempts.
      if (await store.isAccountLocked(user)) {
        return res.status(423).json({ error: `Account locked after too many attempts. Try again in ${lockoutMinutes} minutes.` });
      }

      const valid = await verifyPassword(password, passwordHashOf(user));
      if (!valid) {
        await store.recordFailedLogin(normalized);
        const updated = await store.findUserByEmail(normalized);
        const remaining = Math.max(0, maxFailedAttempts - (updated?.failedLogins ?? updated?.failed_logins ?? 0));
        return res.status(401).json({
          error: remaining > 0
            ? `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
            : `Account locked. Try again in ${lockoutMinutes} minutes.`,
        });
      }

      await store.resetFailedLogins(normalized);
      setSessionCookie(res, user.id, tokenVersionOf(user));
      res.json({ user: store.sanitizeUser(user) });
    } catch (err) {
      console.error('Login error:', err.message);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  });

  // ── Logout ───────────────────────────────────────────────────────────────

  router.post('/logout', (_req, res) => {
    res.clearCookie(cookieName, { path: '/' });
    res.json({ message: 'Logged out.' });
  });

  // ── Change password ─────────────────────────────────────────────────────

  router.post('/change-password', authLimiter, requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!validatePassword(newPassword)) {
        return res.status(400).json({ error: 'New password must be 12-128 characters and not a commonly used one.' });
      }

      // What-if: caller doesn't actually know the current password.
      const valid = await verifyPassword(currentPassword, passwordHashOf(req.user));
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'New password must be different from your current password.' });
      }

      const passwordHash = await hashPassword(newPassword);
      await store.updateUser(req.user.id, { passwordHash });

      // What-if: a stolen session cookie is active elsewhere — bump the token
      // version so every OTHER session is invalidated, then re-issue a fresh
      // cookie so this browser stays logged in.
      const updated = await store.bumpTokenVersion(req.user.id);
      setSessionCookie(res, req.user.id, tokenVersionOf(updated));
      res.json({ message: 'Password changed successfully.' });
    } catch (err) {
      console.error('Change password error:', err.message);
      res.status(500).json({ error: 'Failed to change password. Please try again.' });
    }
  });

  // ── Current user ─────────────────────────────────────────────────────────

  router.get('/me', async (req, res) => {
    try {
      const token = req.cookies?.[cookieName];
      if (!token) return res.json({ user: null });

      const decoded = jwt.verify(token, jwtSecret);
      const user = await store.findUserById(decoded.userId);
      if (!user) return res.json({ user: null });

      // What-if: token was issued before a password change/reset bumped the
      // token version — treat it as dead even though the JWT itself still verifies.
      if ((decoded.tv || 0) !== tokenVersionOf(user)) {
        res.clearCookie(cookieName, { path: '/' });
        return res.json({ user: null });
      }

      res.json({ user: store.sanitizeUser(user) });
    } catch {
      // What-if: token is malformed, expired, or signed with an old secret.
      res.clearCookie(cookieName, { path: '/' });
      res.json({ user: null });
    }
  });

  // ── Middleware ───────────────────────────────────────────────────────────

  async function requireAuth(req, res, next) {
    try {
      const token = req.cookies?.[cookieName];
      if (!token) return res.status(401).json({ error: 'Login required.' });

      const decoded = jwt.verify(token, jwtSecret);
      const user = await store.findUserById(decoded.userId);
      if (!user) return res.status(401).json({ error: 'Login required.' });

      if ((decoded.tv || 0) !== tokenVersionOf(user)) {
        res.clearCookie(cookieName, { path: '/' });
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }

      req.user = user;
      next();
    } catch {
      res.clearCookie(cookieName, { path: '/' });
      res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
  }

  return { router, requireAuth };
}

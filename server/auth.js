import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import {
  createUser, findUserByEmail, findUserById, updateUser,
  recordFailedLogin, resetFailedLogins, isAccountLocked,
  getUsage, PLAN_LIMITS, sanitizeUser, bumpTokenVersion,
  saveVerificationCode, getVerificationCode, deleteVerificationCode,
  createPasswordReset, getPasswordReset, markPasswordResetUsed,
} from './db.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const COOKIE_NAME = 'batch_session';

// ── Rate limiters ────────────────────────────────────────────────────────────
// Each route below gets its OWN limiter instance rather than one shared
// object. Reusing a single instance across signup/login/verify/reset/change
// would accumulate one combined budget across all of them — e.g. a user who
// signs up, mistypes their password twice, then goes to reset it would burn
// through the same 10-request/15-min ceiling for three unrelated actions and
// get locked out of a flow they never repeated. Same window/max per route,
// just not sharing a counter.
function makeAuthLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

const signupLimiter = makeAuthLimiter();
const verifyLimiter = makeAuthLimiter();
const loginLimiter = makeAuthLimiter();
const resetPasswordLimiter = makeAuthLimiter();
const changePasswordLimiter = makeAuthLimiter();

const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3,
  delayMs: (hits) => (hits - 3) * 500,
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many reset requests. Try again in an hour.' },
});

// ── Cookie helper ────────────────────────────────────────────────────────────

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

// ── Validators ───────────────────────────────────────────────────────────────

function validateEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// NIST 800-63B guidance: length matters far more than forced character
// mixes (which push people toward predictable patterns like "Password1!").
// Block the most commonly breached/guessed passwords instead of requiring
// symbols/numbers.
const COMMON_PASSWORDS = new Set([
  'password123', 'password1234', 'password12345', 'passw0rd123',
  '123456789012', 'qwertyuiop12', 'qwerty123456', '1qaz2wsx3edc',
  'letmein12345', 'welcome12345', 'iloveyou1234', 'admin12345678',
  'dragon123456', 'monkey123456', 'football1234', 'baseball1234',
  'trustno1trustno1', 'sunshine1234', 'princess1234', 'superman1234',
  'aaaaaaaaaaaa', '111111111111', '000000000000', 'abcdefghijkl',
  'abc123abc123', 'changeme1234', 'temppassword', 'temporarypass',
]);

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 12 || pw.length > 128) return false;
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return false;
  return true;
}

function sanitize(s, max = 200) {
  return typeof s === 'string' ? s.replace(/[<>]/g, '').trim().slice(0, max) : '';
}

function makeToken(userId, tokenVersion = 0) {
  return jwt.sign({ userId, tv: tokenVersion }, JWT_SECRET, { expiresIn: '7d' });
}

const safeUser = sanitizeUser;

// ── Sign Up ──────────────────────────────────────────────────────────────────

router.post('/signup', signupLimiter, authSlowDown, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email address.' });
    if (!validatePassword(password)) return res.status(400).json({ error: 'Password must be 12–128 characters and not a commonly used one.' });

    const normalized = email.toLowerCase().trim();
    const existing = findUserByEmail(normalized);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = createUser({
      email: normalized,
      passwordHash,
      name: sanitize(name || ''),
      plan: 'free',
    });
    if (!user) return res.status(500).json({ error: 'Failed to create account. Please try again.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    saveVerificationCode(normalized, code, user.id, 'signup');

    try {
      await sendVerificationEmail(normalized, code);
    } catch (e) {
      console.error('Failed to send verification email:', e.message);
    }

    // Only enforce verification when SMTP is actually configured — without
    // it, the code only reaches the server console, which a real user has
    // no way to see, so forcing this step would lock every signup out.
    if (process.env.SMTP_HOST) {
      return res.status(201).json({
        verifyCode: true,
        user: { email: normalized },
        message: 'Account created! Check your email for the verification code.',
      });
    }

    setAuthCookie(res, makeToken(user.id, 0));
    res.status(201).json({ user, message: 'Account created!' });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// ── Verify Email ─────────────────────────────────────────────────────────────

router.post('/verify', verifyLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code required.' });

    const normalized = email.toLowerCase().trim();
    const stored = getVerificationCode(normalized, 'signup');

    if (!stored) return res.status(400).json({ error: 'No verification pending. Please sign up again.' });
    if (Date.now() > stored.expires_at) {
      deleteVerificationCode(normalized, 'signup');
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }
    if (stored.code !== String(code).trim()) return res.status(400).json({ error: 'Invalid code. Please try again.' });

    deleteVerificationCode(normalized, 'signup');
    updateUser(stored.user_id, { emailVerified: true });

    const user = findUserById(stored.user_id);
    setAuthCookie(res, makeToken(user.id, user.token_version || 0));
    res.json({ user: safeUser(user), message: 'Email verified!' });
  } catch (err) {
    console.error('Verify error:', err.message);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ── Login ────────────────────────────────────────────────────────────────────

router.post('/login', loginLimiter, authSlowDown, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const normalized = email.toLowerCase().trim();
    const user = findUserByEmail(normalized);

    if (!user) {
      await bcrypt.hash(String(password), 12); // timing attack prevention
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (isAccountLocked(user)) {
      return res.status(423).json({ error: 'Account locked after too many attempts. Try again in 15 minutes.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      recordFailedLogin(normalized);
      const updated = findUserByEmail(normalized);
      const remaining = Math.max(0, 5 - (updated.failed_logins || 0));
      return res.status(401).json({
        error: remaining > 0
          ? `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'Account locked. Try again in 15 minutes.',
      });
    }

    resetFailedLogins(normalized);
    setAuthCookie(res, makeToken(user.id, user.token_version || 0));
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── Forgot Password ──────────────────────────────────────────────────────────

router.post('/forgot-password', forgotLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email address.' });

    const normalized = email.toLowerCase().trim();
    const user = findUserByEmail(normalized);

    // Always respond success — don't reveal whether email exists
    if (user) {
      const token = createPasswordReset(user.id);
      try {
        await sendPasswordResetEmail(normalized, token);
      } catch (e) {
        console.error('Reset email failed:', e.message);
      }
    }

    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
});

// ── Reset Password ───────────────────────────────────────────────────────────

router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !validatePassword(password)) {
      return res.status(400).json({ error: 'Valid token and password (12+ characters, not a commonly used one) required.' });
    }

    const reset = getPasswordReset(token);
    if (!reset || reset.used || Date.now() > reset.expires_at) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    updateUser(reset.user_id, { passwordHash });
    markPasswordResetUsed(token);
    bumpTokenVersion(reset.user_id);

    const user = findUserById(reset.user_id);
    if (user) resetFailedLogins(user.email);

    res.json({ message: 'Password updated. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// ── Change Password ──────────────────────────────────────────────────────────

router.post('/change-password', changePasswordLimiter, requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: 'New password must be 12–128 characters and not a commonly used one.' });
    }

    const valid = await bcrypt.compare(String(currentPassword || ''), req.user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from your current password.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    updateUser(req.user.id, { passwordHash });
    const updated = bumpTokenVersion(req.user.id);
    setAuthCookie(res, makeToken(req.user.id, updated.token_version || 0));
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: 'Failed to change password. Please try again.' });
  }
});

// ── Logout ───────────────────────────────────────────────────────────────────

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ message: 'Logged out.' });
});

// ── Get Current User ─────────────────────────────────────────────────────────

router.get('/me', (req, res) => {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.json({ user: null });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = findUserById(decoded.userId);
    if (!user) return res.json({ user: null });
    if ((decoded.tv || 0) !== (user.token_version || 0)) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.json({ user: null });
    }

    const usage = getUsage(user.id);
    const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
    res.json({ user: safeUser(user), usage, limits });
  } catch {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ user: null });
  }
});

// ── Middleware ───────────────────────────────────────────────────────────────

export function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Login required.' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = findUserById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Login required.' });
    if ((decoded.tv || 0) !== (user.token_version || 0)) {
      res.clearCookie(COOKIE_NAME, { path: '/' });
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    req.user = user;
    next();
  } catch {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// Same validity check as requireAuth, but redirects to the login page instead
// of returning JSON — used to gate the static tool HTML pages, which aren't
// fetch() API calls and can't do anything useful with a 401 JSON body.
export function requireAuthPage(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) throw new Error('no token');
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = findUserById(decoded.userId);
    if (!user) throw new Error('no user');
    if ((decoded.tv || 0) !== (user.token_version || 0)) throw new Error('stale token');
    req.user = user;
    next();
  } catch {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    const next = encodeURIComponent(req.originalUrl);
    res.redirect(`/login?next=${next}`);
  }
}

export { router as authRouter, JWT_SECRET, COOKIE_NAME };

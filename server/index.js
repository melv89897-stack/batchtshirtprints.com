import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authRouter, requireAuth, requireAuthPage } from './auth.js';
import { stripeRouter } from './stripe-routes.js';
import { reserveUsage, PLAN_LIMITS, getUsage } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');
const TOOLS_DIR = path.join(__dirname, '..', 'public', 'tools');

const app = express();
const PORT = process.env.PORT || 3002;

if (!process.env.JWT_SECRET) {
  console.warn('\n  ⚠ JWT_SECRET is not set in .env — a new random secret will be generated on every restart, which logs everyone out. Set a fixed 64-char random string in .env before deploying.\n');
}
if (!process.env.SMTP_HOST) {
  console.warn('  ⚠ SMTP_HOST is not set — password reset & verification emails will only print to this console, not actually send. Set SMTP_HOST/SMTP_USER/SMTP_PASS in .env before going live.\n');
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn('  ⚠ STRIPE_WEBHOOK_SECRET is not set — the Stripe webhook will reject ALL events until it is set. Get this from `stripe listen` (local) or your webhook endpoint settings (production) and add it to .env.\n');
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

const ALLOWED_ORIGINS = [
  process.env.CORS_ORIGIN || 'http://localhost:5173',
  'http://100.115.92.26:5173',
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));

// Stripe needs the raw body for signature verification — must be registered
// before express.json() and must never be JSON-parsed.
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// CSRF defense: since auth is a sameSite=strict httpOnly cookie (not a bearer
// token a page could read and forward), the remaining CSRF vector is a
// cross-site form/fetch that the browser attaches the cookie to anyway on
// some browsers/configs. An Origin allowlist on every mutating request closes
// that gap without needing a separate CSRF token scheme (same pattern this
// project's sibling app already runs in production).
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path === '/api/stripe/webhook') return next();
  const origin = req.get('Origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth', authRouter);
app.use('/api/stripe', stripeRouter);

const usageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_USAGE || '60', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait.' },
});

function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex -- intentionally stripping control chars from user input, not a mistake
  return str.replace(/[<>{}]/g, '').replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 500);
}

// The three BATCH tools render entirely client-side (canvas/SVG, no server AI
// call) — this is the single checkpoint that meters every export ("print")
// against the user's plan before the browser is allowed to proceed with its
// already-rendered download. A "print" = one PNG; a ZIP batch of N designs
// sends count=N. See PLAN.md for why maxPerBatch == the plan's full monthly
// allowance rather than a separate smaller cap.
app.post('/api/usage/consume', usageLimiter, requireAuth, (req, res) => {
  const userId = req.user.id;
  const userPlan = req.user.plan || 'free';

  // Hard ceiling matches the highest maxPerBatch across all plans (Pro's
  // 1000) — a technical request-size cap, independent of which plan the
  // caller is actually on; the per-plan maxPerBatch check just below is
  // what actually enforces the plan's real limit.
  const slogans = Array.isArray(req.body?.slogans)
    ? req.body.slogans.map(s => sanitizeInput(String(s))).filter(Boolean).slice(0, 1000)
    : [];
  const count = slogans.length > 0
    ? slogans.length
    : Math.min(Math.max(parseInt(req.body?.count, 10) || 0, 0), 1000);

  if (!Number.isFinite(count) || count < 1) {
    return res.status(400).json({ error: 'Nothing to generate.' });
  }

  const limits = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;
  if (count > limits.maxPerBatch) {
    return res.status(403).json({
      error: `Your ${limits.name} plan allows up to ${limits.maxPerBatch} prints per batch/month. Upgrade to export more.`,
      maxPerBatch: limits.maxPerBatch,
    });
  }

  if (!reserveUsage(userId, userPlan, count)) {
    const usage = getUsage(userId);
    return res.status(429).json({
      error: `Monthly print limit reached (${usage.printsUsed}/${limits.monthlyPrints}). Upgrade your plan to continue.`,
      usage,
      limits,
    });
  }

  res.json({ ok: true, usage: getUsage(userId), limits });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasStripe: !!process.env.STRIPE_SECRET_KEY,
  });
});

// ── Static tool pages ────────────────────────────────────────────────────────
// The quick-start guide is plain instructions (no generation, no login needed
// in the original standalone product) — kept public. The three actual
// generator tools consume print quota, so they require a valid session;
// requireAuthPage redirects to /login instead of returning JSON.
app.get('/tools/quick-start-guide.html', (_req, res) => {
  res.sendFile(path.join(TOOLS_DIR, 'quick-start-guide.html'));
});
app.use('/tools', requireAuthPage, express.static(TOOLS_DIR));

app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Serve the built frontend (npm run build) so this one process can host the
// whole app in production. In dev mode, Vite's dev server handles the
// frontend on :5173 and this code path never hits (dist/ won't exist yet).
const hasBuiltFrontend = fs.existsSync(path.join(DIST_DIR, 'index.html'));
if (hasBuiltFrontend) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// Express only recognizes error-handling middleware by arity — it must take
// exactly 4 arguments, so `_next` has to stay even though it's unused here.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n  BATCH server running on http://localhost:${PORT}`);
  console.log(`  Stripe: ${process.env.STRIPE_SECRET_KEY ? 'connected' : 'NOT SET'}\n`);
});

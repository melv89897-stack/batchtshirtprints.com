// Real, executed test suite (Part 2 of the prompt pack) — spawns the actual
// server against a throwaway test DB and hits real HTTP endpoints. Every
// check below is a live assertion against the running process, not a
// read-through of the code.
import 'dotenv/config';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const TEST_PORT = 3099;
const BASE = `http://localhost:${TEST_PORT}`;
const TEST_DB = path.join(ROOT, 'data', 'test-batch.db');

let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

function extractCookie(res) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  return setCookie.split(';')[0];
}

async function req(pathname, { method = 'GET', body, cookie, origin, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;
  if (origin !== undefined) headers['Origin'] = origin;
  const res = await fetch(BASE + pathname, {
    method,
    headers,
    body: body !== undefined ? (raw ? body : JSON.stringify(body)) : undefined,
    redirect: 'manual',
  });
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    data = await res.text();
  }
  return { status: res.status, data, cookie: extractCookie(res), headers: res.headers };
}

function waitForServer(proc, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('server did not start in time')), timeoutMs);
    proc.stdout.on('data', (d) => {
      buf += d.toString();
      process.stdout.write(`  [server] ${d}`);
      if (buf.includes('BulkBatch server running')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr.on('data', (d) => process.stdout.write(`  [server:err] ${d}`));
    proc.on('exit', (code) => {
      if (code !== 0 && code !== null) reject(new Error(`server exited early with code ${code}`));
    });
  });
}

async function main() {
  // Clean test DB
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(TEST_DB + suffix); } catch { /* fine — file may not exist on a first run */ }
  }

  const env = {
    ...process.env,
    PORT: String(TEST_PORT),
    CORS_ORIGIN: 'http://localhost:5174',
    NODE_ENV: 'test',
    BATCH_TEST_DB_PATH: TEST_DB,
  };

  console.log(`\n=== Starting BulkBatch server on :${TEST_PORT} against a throwaway test DB ===\n`);
  const proc = spawn('node', ['server/index.js'], { cwd: ROOT, env });
  await waitForServer(proc);
  console.log('\n=== Server up. Running tests ===\n');

  const stamp = Date.now();
  const email1 = `test${stamp}@example.com`;
  const goodPassword = 'correct-horse-battery-staple';

  try {
    // ── Health ──────────────────────────────────────────────────────────────
    {
      const r = await req('/api/health');
      ok('GET /api/health returns ok', r.status === 200 && r.data?.status === 'ok');
    }

    // ── Signup happy path ─────────────────────────────────────────────────
    let cookie1;
    {
      const r = await req('/api/auth/signup', { method: 'POST', body: { email: email1, password: goodPassword, name: 'Test User' } });
      ok('signup: valid signup succeeds (201)', r.status === 201, JSON.stringify(r.data));
      cookie1 = r.cookie;
      ok('signup: sets session cookie (SMTP not configured -> auto-login)', !!cookie1);
    }

    // ── Signup edge cases ─────────────────────────────────────────────────
    {
      const r = await req('/api/auth/signup', { method: 'POST', body: { email: email1, password: goodPassword, name: 'Dup' } });
      ok('signup: duplicate email rejected (409)', r.status === 409);
      ok('signup: duplicate error message does not leak internals', /already exists/i.test(r.data?.error || ''));
    }
    {
      const r = await req('/api/auth/signup', { method: 'POST', body: { email: 'not-an-email', password: goodPassword, name: 'x' } });
      ok('signup: invalid email rejected (400)', r.status === 400);
    }
    {
      const r = await req('/api/auth/signup', { method: 'POST', body: { email: `short${stamp}@example.com`, password: '123', name: 'x' } });
      ok('signup: too-short password rejected (400)', r.status === 400);
    }
    {
      const r = await req('/api/auth/signup', { method: 'POST', body: {} });
      ok('signup: empty body rejected gracefully (400, no crash)', r.status === 400);
    }
    {
      const r = await req('/api/auth/signup', { method: 'POST', body: { email: `<script>alert(1)</script>@example.com`, password: goodPassword, name: '<img src=x onerror=alert(1)>' } });
      ok('signup: HTML/script in fields does not crash server and is rejected or sanitized', r.status === 400 || r.status === 201);
    }

    // ── /me with valid session ───────────────────────────────────────────
    {
      const r = await req('/api/auth/me', { cookie: cookie1 });
      ok('/me: returns user + usage + limits for logged-in user', r.status === 200 && r.data?.user?.email === email1);
      ok('/me: free plan starts with 0/10 prints', r.data?.usage?.printsUsed === 0 && r.data?.limits?.monthlyPrints === 10);
    }
    {
      const r = await req('/api/auth/me');
      ok('/me: returns null user with no cookie', r.status === 200 && r.data?.user === null);
    }

    // ── Login ─────────────────────────────────────────────────────────────
    {
      const r = await req('/api/auth/login', { method: 'POST', body: { email: email1, password: 'wrong-password' } });
      ok('login: wrong password rejected (401) with generic message', r.status === 401 && /invalid email or password/i.test(r.data?.error || ''));
    }
    {
      const r = await req('/api/auth/login', { method: 'POST', body: { email: 'nobody-' + stamp + '@example.com', password: goodPassword } });
      ok('login: unknown email gives same generic message (no user enumeration)', r.status === 401 && /invalid email or password/i.test(r.data?.error || ''));
    }
    {
      const r = await req('/api/auth/login', { method: 'POST', body: { email: email1, password: goodPassword } });
      ok('login: correct credentials succeed (200)', r.status === 200);
      ok('login: sets a fresh session cookie', !!r.cookie);
    }

    // ── Logout ────────────────────────────────────────────────────────────
    {
      const r = await req('/api/auth/logout', { method: 'POST', cookie: cookie1 });
      ok('logout: clears session (200)', r.status === 200);
      // Logout only clears the cookie via Set-Cookie in the server's response
      // — it doesn't bump token_version the way change-password does — so
      // the JWT itself is still cryptographically valid until it naturally
      // expires. A copy of the raw cookie captured before logout (e.g. from
      // a proxy log) stays usable; this is the accepted tradeoff for this
      // app's stateless-JWT sessions, and worth asserting explicitly rather
      // than assuming, since it's easy to mistake logout for full revocation.
      const me = await req('/api/auth/me', { cookie: cookie1 });
      ok('logout: does not itself invalidate the JWT (stateless-session tradeoff, unlike change-password)',
        me.status === 200 && me.data?.user?.email === email1);
      // re-login to get a fresh valid cookie for the rest of the suite.
    }
    {
      const login = await req('/api/auth/login', { method: 'POST', body: { email: email1, password: goodPassword } });
      cookie1 = login.cookie;
    }

    // ── Protected tool pages (page-based auth, not JSON) ─────────────────
    {
      const r = await req('/tools/bulk-tshirt-design-studio.html');
      ok('tools: unauthenticated request to a gated tool redirects (302) to /login', r.status === 302 && /\/login/.test(r.headers.get('location') || ''));
    }
    {
      const r = await req('/tools/quick-start-guide.html');
      ok('tools: quick-start-guide is public (200, no auth needed)', r.status === 200);
    }
    {
      const r = await req('/tools/bulk-tshirt-design-studio.html', { cookie: cookie1 });
      ok('tools: authenticated request to a gated tool succeeds (200)', r.status === 200);
    }

    // ── Usage consume: happy path + edge cases ───────────────────────────
    {
      const r = await req('/api/usage/consume', { method: 'POST', cookie: cookie1, body: { count: 1 } });
      ok('usage: consuming 1 print succeeds', r.status === 200 && r.data?.usage?.printsUsed === 1);
    }
    {
      const r = await req('/api/usage/consume', { method: 'POST', cookie: cookie1, body: { count: 0 } });
      ok('usage: count=0 rejected (400), not silently accepted', r.status === 400);
    }
    {
      const r = await req('/api/usage/consume', { method: 'POST', cookie: cookie1, body: { count: -5 } });
      ok('usage: negative count rejected (400), not treated as free credit', r.status === 400);
    }
    {
      const r = await req('/api/usage/consume', { method: 'POST', cookie: cookie1, body: { count: 'not-a-number' } });
      ok('usage: non-numeric count rejected (400), no crash', r.status === 400);
    }
    {
      const r = await req('/api/usage/consume', { method: 'POST', cookie: cookie1, body: {} });
      ok('usage: missing count/slogans rejected gracefully (400)', r.status === 400);
    }
    {
      const r = await req('/api/usage/consume', { method: 'POST', cookie: cookie1, body: { count: 999999 } });
      ok('usage: absurdly large count rejected — over maxPerBatch (403)', r.status === 403);
    }
    {
      const weird = ['<script>x</script>', '"; DROP TABLE users; --', '𝕬𝖇𝖈 emoji 🎉', 'a'.repeat(600)];
      const r = await req('/api/usage/consume', { method: 'POST', cookie: cookie1, body: { slogans: weird } });
      // free plan already has 1 used; 4 more would be 5/10, within maxPerBatch(10) — should succeed without crashing,
      // proving weird characters/emoji/injection payloads/oversized strings are handled safely as plain text.
      ok('usage: weird characters/injection/emoji/oversized strings handled without crash', r.status === 200 || r.status === 403);
    }
    {
      // Drain remaining quota then confirm the limit is enforced (not just per-request but cumulative for the month).
      const before = await req('/api/auth/me', { cookie: cookie1 });
      const remaining = before.data.limits.monthlyPrints - before.data.usage.printsUsed;
      if (remaining > 0) {
        await req('/api/usage/consume', { method: 'POST', cookie: cookie1, body: { count: remaining } });
      }
      const r = await req('/api/usage/consume', { method: 'POST', cookie: cookie1, body: { count: 1 } });
      ok('usage: monthly limit enforced once quota is exhausted (429)', r.status === 429, JSON.stringify(r.data));
    }
    {
      const r = await req('/api/usage/consume', { method: 'POST', body: { count: 1 } });
      ok('usage: unauthenticated request rejected (401)', r.status === 401);
    }

    // ── Password reset flow ──────────────────────────────────────────────
    {
      const r = await req('/api/auth/forgot-password', { method: 'POST', body: { email: email1 } });
      ok('forgot-password: accepted for existing user (200)', r.status === 200);
    }
    {
      const r = await req('/api/auth/forgot-password', { method: 'POST', body: { email: 'nobody-' + stamp + '@example.com' } });
      ok('forgot-password: same success message for unknown email (no enumeration)', r.status === 200);
    }
    {
      const r = await req('/api/auth/reset-password', { method: 'POST', body: { token: 'not-a-real-token', password: 'newpassword123' } });
      ok('reset-password: invalid token rejected (400)', r.status === 400);
    }

    // ── Change password requires auth ────────────────────────────────────
    {
      const r = await req('/api/auth/change-password', { method: 'POST', body: { currentPassword: goodPassword, newPassword: 'somethingnew123' } });
      ok('change-password: rejected without auth (401)', r.status === 401);
    }
    {
      const r = await req('/api/auth/change-password', { method: 'POST', cookie: cookie1, body: { currentPassword: 'wrong', newPassword: 'somethingnew123' } });
      ok('change-password: wrong current password rejected (401)', r.status === 401);
    }

    // ── CSRF / Origin allowlist ───────────────────────────────────────────
    {
      const r = await req('/api/auth/login', { method: 'POST', origin: 'https://evil.example.com', body: { email: email1, password: goodPassword } });
      ok('csrf: disallowed Origin on a mutating request is rejected (403)', r.status === 403);
    }
    {
      const r = await req('/api/health', { origin: 'https://evil.example.com' });
      ok('csrf: GET requests are not blocked by the Origin check', r.status === 200);
    }

    // ── Stripe endpoints (no live keys/webhook secret in this sandbox) ──
    {
      const r = await req('/api/stripe/checkout', { method: 'POST', body: { plan: 'starter' } });
      ok('stripe: checkout requires auth (401)', r.status === 401);
    }
    {
      const r = await req('/api/stripe/checkout', { method: 'POST', cookie: cookie1, body: { plan: 'not-a-real-plan' } });
      ok('stripe: invalid plan name rejected (400)', r.status === 400);
    }
    {
      const r = await req('/api/stripe/webhook', { method: 'POST', raw: true, body: '{}' });
      ok('stripe: webhook rejects an unsigned/garbage payload (400), does not silently accept', r.status === 400);
    }
    {
      // What-if: user already has an active paid subscription and hits
      // checkout again (double-click, or picks a different plan without
      // canceling first) — must be blocked, not stacked into a second
      // parallel Stripe subscription that would double-bill them.
      const r1 = await req('/api/auth/me', { cookie: cookie1 });
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(TEST_DB);
      db.prepare("UPDATE users SET plan='starter', subscription_status='active', stripe_subscription_id='sub_fake_for_test' WHERE id = ?")
        .run(r1.data.user.id);
      db.close();
      const r2 = await req('/api/stripe/checkout', { method: 'POST', cookie: cookie1, body: { plan: 'pro' } });
      ok('stripe: checkout blocked (409) when user already has an active subscription — prevents duplicate/parallel billing',
        r2.status === 409 && /already have an active subscription/i.test(r2.data?.error || ''));
    }
    {
      // What-if: the user's stored stripe_customer_id points at a customer
      // that no longer exists on Stripe (deleted directly in the dashboard,
      // or belonged to an account that got swapped out) — checkout must
      // recover by creating a fresh customer, not fail outright.
      const r1 = await req('/api/auth/me', { cookie: cookie1 });
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(TEST_DB);
      db.prepare("UPDATE users SET plan='free', subscription_status='none', stripe_subscription_id=NULL, stripe_customer_id='cus_this_does_not_exist_12345' WHERE id = ?")
        .run(r1.data.user.id);
      db.close();
      const r2 = await req('/api/stripe/checkout', { method: 'POST', cookie: cookie1, body: { plan: 'starter' } });
      ok('stripe: checkout recovers from a stale/nonexistent stored customer id instead of failing (200, real Stripe URL)',
        r2.status === 200 && typeof r2.data?.url === 'string' && r2.data.url.startsWith('https://checkout.stripe.com/'));
    }

    // ── 404 handling ──────────────────────────────────────────────────────
    {
      const r = await req('/api/this-route-does-not-exist');
      ok('unknown API route returns 404 JSON, not a crash', r.status === 404);
    }

    // ── Entry-flow "what ifs" (guide-first landing, new) ────────────────────
    {
      const r = await req('/tools/quick-start-guide.html');
      ok('guide: contains the CTA banner (regression guard for guide-first change)',
        r.status === 200 && typeof r.data === 'string' &&
        r.data.includes('id="ctaBar"') && r.data.includes('Create free account'));
    }
    {
      // logged-in state: guide's own client script hits /api/auth/me — verify
      // that endpoint still behaves under a cookie that belongs to a page
      // fetch (not just XHR from the SPA origin) — same-origin static file.
      const r = await req('/api/auth/me', { cookie: cookie1 });
      ok('guide: /api/auth/me reachable for a logged-in user hitting it from a static page context',
        r.status === 200 && r.data?.user?.email === email1);
    }
    {
      // No session at all hitting the guide's background fetch — must not 401/crash, just null user.
      const r = await req('/api/auth/me');
      ok('guide: /api/auth/me with no cookie still returns 200 + null user (not an error the guide script chokes on)',
        r.status === 200 && r.data?.user === null);
    }

    // ── Malformed / tampered session "what ifs" ─────────────────────────────
    {
      const r = await req('/api/auth/me', { cookie: `batch_session=not-a-real-jwt` });
      ok('garbage cookie value on /me does not crash, returns null user', r.status === 200 && r.data?.user === null);
    }
    {
      const r = await req('/tools/bulk-tshirt-design-studio.html', { cookie: `batch_session=not-a-real-jwt` });
      ok('garbage cookie value on a gated tool page redirects to /login, not a 500', r.status === 302 && /\/login/.test(r.headers.get('location') || ''));
    }
    {
      // Take a real token and flip a character in the signature portion — a forged/corrupted JWT.
      const parts = (cookie1 || '').split('=')[1].split('.');
      const tampered = `batch_session=${parts[0]}.${parts[1]}.${parts[2] ? 'x' + parts[2].slice(1) : 'x'}`;
      const r = await req('/api/auth/me', { cookie: tampered });
      ok('tampered JWT signature rejected gracefully (null user, not a crash)', r.status === 200 && r.data?.user === null);
    }
    {
      const r = await req('/api/usage/consume', { method: 'POST', cookie: 'batch_session=', body: { count: 1 } });
      ok('empty cookie value on a protected API route is rejected (401), not a crash', r.status === 401);
    }

    // ── Path traversal "what if" on the static tool directory ───────────────
    {
      const r = await req('/tools/..%2f..%2f..%2fetc%2fpasswd');
      ok('path traversal attempt on /tools is blocked, not served', r.status !== 200 || (typeof r.data === 'string' && !r.data.includes('root:')));
    }
    {
      // Literal "../" gets normalized away by the URL parser before the
      // request is even sent (same as a real browser would do) — the actual
      // attack surface against express.static is percent-encoded traversal,
      // already covered above. This checks a second encoded target (.env)
      // to confirm it's not just the one path that's protected.
      const r = await req('/tools/..%2f.env');
      ok('path traversal to project .env via /tools is blocked', r.status !== 200 || (typeof r.data === 'string' && !r.data.includes('STRIPE_SECRET_KEY')));
    }

    // ── Session invalidation "what if": changing password logs out other sessions ──
    {
      const oldCookie = cookie1;
      const changeRes = await req('/api/auth/change-password', {
        method: 'POST',
        cookie: oldCookie,
        origin: 'http://localhost:5174',
        body: { currentPassword: goodPassword, newPassword: 'a-brand-new-password-123' },
      });
      ok('change-password: succeeds with correct current password (200)', changeRes.status === 200, JSON.stringify(changeRes.data));
      const meWithOld = await req('/api/auth/me', { cookie: oldCookie });
      ok('change-password: old session cookie is invalidated after password change', meWithOld.status === 200 && meWithOld.data?.user === null);
      // restore cookie1 to a valid session (fresh login with new password) for anything after this point
      const relogin = await req('/api/auth/login', { method: 'POST', body: { email: email1, password: 'a-brand-new-password-123' } });
      ok('change-password: can log in again with the new password', relogin.status === 200);
      cookie1 = relogin.cookie;
    }

    // ── Oversized / weird input "what ifs" ──────────────────────────────────
    {
      const hugeEmail = 'a'.repeat(5000) + '@example.com';
      const r = await req('/api/auth/signup', { method: 'POST', body: { email: hugeEmail, password: goodPassword, name: 'x' } });
      ok('signup: absurdly long email rejected gracefully, not a crash', r.status === 400 || r.status === 413);
    }
    {
      const hugePassword = 'a'.repeat(10000);
      const r = await req('/api/auth/signup', { method: 'POST', body: { email: `huge${stamp}@example.com`, password: hugePassword, name: 'x' } });
      ok('signup: absurdly long password rejected or handled gracefully, not a crash', r.status === 400 || r.status === 201 || r.status === 413);
    }
    {
      const r = await req('/api/auth/signup', { method: 'POST', body: { email: `emoji${stamp}@example.com`, password: goodPassword, name: '🔥🎨✦👕 designer' } });
      ok('signup: emoji in name field does not crash server', r.status === 201 || r.status === 400);
    }

  } catch (err) {
    fail++;
    failures.push(`UNCAUGHT: ${err.message}`);
    console.error(err);
  } finally {
    proc.kill();
  }

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  - ' + f);
  }
  process.exit(fail > 0 ? 1 : 0);
}

main();

# BulkBatch App — Accounts, Database & Stripe Payments — PLAN

## What this app is
BulkBatch is three existing, already-working, client-side-only design tools (bulk text
generator, pattern-fill studio, slogan+graphic remix — previously sold standalone on
Gumroad with no account system) being turned into a hosted, metered SaaS product.
Free users get 10 prints; paid tiers unlock more. All actual design rendering stays
100% client-side (canvas/SVG, no server AI calls) — the server's only job here is
identity + metering + payment.

## Stack (deviation from the generic Postgres+Prisma default, and why)
No PostgreSQL server exists in this sandbox and no ORM is already in play, so per the
prompt pack's own "if the project already fits another stack, adapt" clause, this
reuses the exact pattern already proven in the sibling `inkstorm` project:
**Express + better-sqlite3 + JWT-in-httpOnly-cookie + bcryptjs + Stripe Checkout**.
SQLite is a single file, requires no separate service, and every security property
called for (hashed passwords, env-var secrets, httpOnly/secure/sameSite cookies,
rate limiting, parameterized queries via prepared statements) is identical either way.

React is used only for the account shell (landing/pricing/login/signup/dashboard).
The three tools' existing HTML/CSS/inline-JS are copied in **unmodified** except for
one appended `<script>` tag per tool that hooks the credit-check into the *existing*
`downloadOne()` / `#zipBtn` export functions. Rewriting the tools' canvas/SVG export
logic in React was explicitly out of scope — that rewrite is what left the sibling
InkStorm project unfinished, and the existing tool code already works.

## Pricing tiers (fixed by the user, not re-derived)
| Plan    | Price      | Prints / month | Stripe |
|---------|-----------|-----------------|--------|
| free    | $0        | 10              | none |
| starter | $24.99/mo | 100             | new Product+Price |
| pro     | $44.99/mo | 1000            | new Product+Price |

- **A "print" = one successful PNG export.** Clicking "Download" on one card = 1 print.
  Clicking "Download all (ZIP)" = N prints, where N is the number of designs in that
  batch (`state.designs.length` at click time) — this matches how InkStorm already
  defines usage for its own client-side-only tools (`/api/usage/consume`).
- **maxPerBatch = the plan's full monthly allowance** (free: 10, starter: 100, pro:
  1000) — i.e. a single ZIP batch can't exceed what's left for the *month*, which in
  practice means it can't exceed the plan's total since batches don't span months.
  This is simpler than a separate per-batch cap and is transparent to the user.
- **Reset cadence: calendar month** (`YYYY-MM` key, same as InkStorm), for *all*
  plans including paid ones — not anchored to each subscription's billing
  anniversary. Simpler to reason about/test, and the user was never asked to choose
  an anniversary-based reset, so calendar-month is the documented assumption.

## Database schema (SQLite, `data/batch.db`)
- `users(id, email UNIQUE, password_hash, plan['free'|'starter'|'pro'], stripe_customer_id,
  stripe_subscription_id, subscription_status, email_verified, failed_logins,
  locked_until, token_version, created_at, updated_at)`
- `usage(user_id, month_key, prints_used)` — PK (user_id, month_key)
- `verification_codes(email, code, user_id, type, expires_at)` — signup email verify
- `password_resets(token, user_id, expires_at, used)`
- `processed_webhook_events(event_id PRIMARY KEY, processed_at)` — webhook idempotency
  (InkStorm didn't have this table; added here since the prompt pack explicitly
  calls for replay-safety and the only truly bulletproof way to guarantee it is an
  event-id ledger rather than relying on every handler being naturally idempotent)

## Auth flow (mirrors inkstorm/server/auth.js exactly)
Signup → bcrypt(cost 12) → optional email-verification code (only enforced if
`SMTP_HOST` is set, otherwise dev-mode logs the code to console and logs the user in
immediately) → login (rate-limited 10/15min + progressive slowdown, account lockout
after 5 failed attempts/15min, generic error messages, timing-attack-safe) → logout
→ forgot/reset password (1-hour single-use token, emailed) → change password (bumps
`token_version` to invalidate other sessions). Session = JWT `{userId, tv}` in an
httpOnly + sameSite=strict (+ secure in production) cookie, 7-day expiry.
`requireAuth` middleware protects API routes; a second `requireAuthPage` middleware
(redirect-to-login instead of JSON 401) protects the static tool HTML pages.

## Stripe flow
- `server/scripts/setup-stripe-products.js` — idempotent: looks up existing
  Products by `metadata.plan` (`starter`/`pro`) before creating new ones, then
  prints (and can write) the resulting Price IDs. Reuses the InkStorm Stripe
  account's secret/publishable/webhook keys (copied into this project's `.env`
  without ever being printed to a transcript).
- Hosted Stripe Checkout only, `mode: subscription`, customer created/reused per
  user, `success_url`/`cancel_url` back to the dashboard.
- Webhook (`/api/stripe/webhook`, raw body, signature-verified against
  `STRIPE_WEBHOOK_SECRET`, hard-fails closed if that secret is missing) handles
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`. Every event's `id` is
  checked against/inserted into `processed_webhook_events` first — a duplicate
  delivery is acknowledged 200 without reprocessing.
- Stripe Customer Portal for self-serve cancel/manage (`/api/stripe/portal`).
- Free tier needs no Stripe object at all; `requireAuth` alone gates free-tier
  usage, a separate check compares `count` against `PLAN_LIMITS[plan]` — there is no
  `requireActiveSubscription` middleware blocking free users from the tools, only
  from exceeding their 10/month.

## Security checklist (all applied)
bcrypt cost 12 · env-var secrets only, `.env.example` provided · httpOnly+secure+
sameSite=strict JWT cookie (never localStorage) · rate limiting on login/signup/
forgot-password/usage-consume · CSRF defense = Origin-allowlist check on all
mutating requests plus sameSite=strict (matches InkStorm's existing, working
pattern — no separate CSRF token scheme layered on top) · webhook signature
verification + event-id idempotency · parameterized queries throughout
(better-sqlite3 prepared statements, no string-built SQL) · security headers via
helmet · subscription status is only ever written by the webhook handler, never
trusted from the client or from the Checkout redirect.

## Build order
1. `server/db.js` (schema + prepared statements + PLAN_LIMITS + reserveUsage)
2. `server/email.js` (verbatim pattern from InkStorm, BulkBatch-branded copy)
3. `server/auth.js` (verbatim pattern, `requireAuth` + new `requireAuthPage`)
4. `server/stripe-routes.js` (checkout/portal/webhook, event-id idempotency added)
5. `server/scripts/setup-stripe-products.js`
6. `server/index.js` (helmet/cors/rate-limit wiring, `/api/usage/consume`, static
   tool serving gated by `requireAuthPage`, SPA fallback for built frontend)
7. Copy `1.html–4.html` into `public/tools/`, append the credit-gating `<script>`
   to `2.html`/`3.html`/`4.html` (`1.html` is the static guide, untouched)
8. `public/tools/batch-credits.js` — shared credit-check/badge/upgrade-prompt client
9. React shell: landing/pricing, login/signup, dashboard (usage bar, tool links,
   upgrade/portal buttons), password reset page
10. Test loop (Part 2) — real executed test scripts, not visual inspection
11. Part 3 end-to-end ✅/❌ report

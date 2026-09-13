# Master Security Template

Three copy-paste-able modules for the parts every paid SaaS app needs:
login, "users only see their own data," and taking payment. Pull the
folder you need into a new project and wire it up — each module is
independent of the others and of this specific app.

```
master-security-template/
  auth/
    passwords.js       — bcrypt hashing + email/password validation
    authRouter.js       — signup, login, logout, change-password, session cookies, lockout
  database/
    scopedQuery.js       — SQLite/MySQL row-ownership guard (app-layer)
    postgres-rls-policies.sql — Postgres native Row-Level Security (database-layer)
  payments/
    checkoutRouter.js    — Stripe Checkout session creation + billing portal
    webhookRouter.js     — verified Stripe webhook listener
    CheckoutButton.jsx   — React "Subscribe" button
```

Every module fails LOUD on missing/misconfigured secrets instead of
silently degrading — e.g. no `jwtSecret` throws at startup rather than
generating a throwaway one, no `webhookSecret` rejects every webhook
instead of trusting unsigned requests. That's intentional: a security
template should never have a "quiet" insecure mode.

## Quick start (Express + React)

```js
// server/index.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { createAuthRouter } from './master-security-template/auth/authRouter.js';
import { createScopedDb } from './master-security-template/database/scopedQuery.js';
import { createCheckoutRouter } from './master-security-template/payments/checkoutRouter.js';
import { createWebhookRouter } from './master-security-template/payments/webhookRouter.js';
import { myUserStore, myCustomerStore, rawDb } from './yourDatabaseCode.js';

const app = express();

// Webhook route needs the RAW body, so mount it before express.json().
app.use('/api/stripe', createWebhookRouter({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  handlers: {
    'checkout.session.completed': async (event) => {
      const { userId, plan } = event.data.object.metadata;
      await myUserStore.updateUser(userId, { plan });
    },
  },
}));

app.use(express.json());
app.use(cookieParser());

const { router: authRouter, requireAuth } = createAuthRouter(myUserStore, {
  jwtSecret: process.env.JWT_SECRET, // openssl rand -hex 64
});
app.use('/api/auth', authRouter);

app.use('/api', createCheckoutRouter(myCustomerStore, {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  requireAuth,
  prices: { pro: process.env.STRIPE_PRICE_PRO },
  successUrl: 'https://yourapp.com?payment=success',
  cancelUrl: 'https://yourapp.com?payment=cancelled',
}));

// Row-ownership guard for any user-owned table (SQLite/MySQL):
const scopedDb = createScopedDb(rawDb);
app.get('/api/my-stuff', requireAuth, (req, res) => {
  res.json(scopedDb.findAll('designs', req.user.id));
});
```

```jsx
// src/PricingPage.jsx
import { CheckoutButton } from '../master-security-template/payments/CheckoutButton.jsx';

<CheckoutButton plan="pro" label="Upgrade to Pro" onError={(msg) => alert(msg)} />
```

## What you have to write per project

- **A store adapter** for `auth/authRouter.js` and `payments/checkoutRouter.js` —
  a handful of functions (`findUserByEmail`, `createUser`, `getCustomerId`, …)
  that talk to whatever database you're actually using. This is the one
  piece that can't be generic; everything else in these modules is reusable
  as-is. See the JSDoc comment at the top of each router file for the exact
  interface.
- **Table/schema setup** — `scopedQuery.js` and the RLS SQL both assume your
  user-owned tables have a `user_id` column.

## Choosing database vs. app-layer row protection

Use `postgres-rls-policies.sql` (database-enforced) when your app runs on
Postgres/Supabase — it protects every query path, including ones you add
later and forget to scope manually. Use `scopedQuery.js` (app-layer) for
SQLite/MySQL, or as a second layer of defense on top of Postgres RLS.
Don't rely on app-layer scoping alone as your only protection if the
database supports RLS — a single missed `WHERE user_id = ?` in future code
is a real-world way this class of bug ships.

## Security notes carried over from production use

- Passwords are bcrypt-hashed at cost factor 12, never stored or logged in
  plaintext.
- Login responses take the same amount of time whether the email exists or
  not, so timing can't be used to enumerate registered accounts.
- Failed logins lock the account for 15 minutes after 5 attempts.
- Changing a password invalidates every other active session (a stolen
  cookie stops working immediately), not just the one that changed it.
- Stripe webhooks are rejected outright if unsigned or misconfigured —
  never trusted just because a request claims to be from Stripe.

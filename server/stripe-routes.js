import express from 'express';
import Stripe from 'stripe';
import { requireAuth } from './auth.js';
import {
  findUserByStripeCustomer, updateUser,
  wasWebhookEventProcessed, markWebhookEventProcessed,
} from './db.js';

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const FRONTEND = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Price IDs — set via .env after running `npm run setup:stripe`, or resolved
// at runtime by ensureProducts() below (which also auto-creates them once).
const PLAN_META = {
  starter: { name: 'BATCH Starter', price: 499, description: '100 prints per month' },
  pro:     { name: 'BATCH Pro',     price: 999, description: '1000 prints per month' },
};

const priceIds = {
  starter: process.env.STRIPE_PRICE_STARTER || null,
  pro:     process.env.STRIPE_PRICE_PRO     || null,
};

async function ensureProducts() {
  if (!stripe) return;

  try {
    // Look for existing BATCH products first to avoid creating duplicates.
    // Matched on metadata.app === 'batch' AND metadata.plan === key — NOT on
    // plan alone. This Stripe account is shared with a sibling app
    // (InkStorm), which independently tags its own products with
    // metadata.plan values like 'pro'/'starter' — matching on plan alone
    // once caused this code to silently adopt InkStorm's leftover "Starter"
    // product as BATCH's "pro" plan (right price, wrong product name/branding
    // shown at checkout). The app-scoped tag prevents that cross-app collision.
    const products = await stripe.products.list({ limit: 50, active: true });
    const productByPlan = {};
    for (const product of products.data) {
      const plan = product.metadata?.plan;
      if (product.metadata?.app === 'batch' && plan && PLAN_META[plan]) productByPlan[plan] = product;
    }

    for (const key of Object.keys(PLAN_META)) {
      let product = productByPlan[key];
      if (!product) {
        product = await stripe.products.create({
          name: PLAN_META[key].name,
          description: PLAN_META[key].description,
          metadata: { app: 'batch', plan: key },
        });
      }

      // Stripe prices are immutable once created — if the price on file
      // doesn't match the current PLAN_META amount (e.g. a price change
      // like this session's $24.99->$4.99), the old Price object can't be
      // edited. Create a fresh Price at the new amount, point checkout at
      // that one, and deactivate the stale price so it can't be reused by
      // anything still holding its id.
      const activePrices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
      const current = activePrices.data.find(p => p.unit_amount === PLAN_META[key].price && p.recurring?.interval === 'month');

      if (current) {
        priceIds[key] = current.id;
      } else {
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: PLAN_META[key].price,
          currency: 'usd',
          recurring: { interval: 'month' },
          metadata: { app: 'batch', plan: key },
        });
        priceIds[key] = price.id;
        console.log(`  [stripe] created new ${key} price ${price.id} (${PLAN_META[key].price}c) — repricing`);
        for (const stale of activePrices.data) {
          if (stale.id !== price.id) {
            await stripe.prices.update(stale.id, { active: false }).catch(() => {});
          }
        }
      }
    }

    console.log('  Stripe price IDs:', JSON.stringify(priceIds));
    console.log('  Add these to .env to avoid re-creating on restart:');
    console.log(`  STRIPE_PRICE_STARTER=${priceIds.starter}`);
    console.log(`  STRIPE_PRICE_PRO=${priceIds.pro}`);
  } catch (err) {
    console.error('  Stripe setup error:', err.message);
  }
}

ensureProducts();

// ── Checkout ─────────────────────────────────────────────────────────────────

router.post('/checkout', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payments not configured.' });

  const { plan } = req.body;
  if (!PLAN_META[plan]) return res.status(400).json({ error: 'Invalid plan.' });

  // What-if: user already has an active paid subscription and clicks
  // "Upgrade" again (double-click, browser back, or picking a different
  // plan without canceling first). Without this check, Checkout would
  // happily create a SECOND parallel subscription — Stripe has no built-in
  // "one subscription per customer" limit — and the customer would be
  // billed for both every month until someone noticed. Direct them to the
  // billing portal instead, which changes/cancels the existing subscription
  // correctly (with proration) rather than stacking a new one on top.
  if (req.user.subscription_status === 'active' && req.user.stripe_subscription_id) {
    return res.status(409).json({
      error: 'You already have an active subscription. Use "Manage billing" to change or cancel your plan instead.',
    });
  }

  try {
    await ensureProducts();
    const priceId = priceIds[plan];
    if (!priceId) return res.status(503).json({ error: 'Plan unavailable. Try again shortly.' });

    let customerId = req.user.stripe_customer_id;
    // What-if: the stored customer id doesn't actually exist on Stripe's
    // side anymore (e.g. it was deleted directly in the Stripe dashboard,
    // or — as happened during this app's own testing — the whole Stripe
    // account it belonged to was swapped out). Verify it's real before
    // reusing it; fall back to creating a fresh customer instead of letting
    // checkout fail outright on a stale id we have no way to repair.
    if (customerId) {
      const stillExists = await stripe.customers.retrieve(customerId).catch(() => null);
      if (!stillExists || stillExists.deleted) customerId = null;
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name || undefined,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      updateUser(req.user.id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: `${FRONTEND}/dashboard?payment=success`,
      cancel_url: `${FRONTEND}/dashboard?payment=cancelled`,
      metadata: { userId: req.user.id, plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to start checkout. Please try again.' });
  }
});

// ── Billing Portal ───────────────────────────────────────────────────────────

router.post('/portal', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payments not configured.' });

  const customerId = req.user.stripe_customer_id;
  if (!customerId) return res.status(400).json({ error: 'No active subscription found.' });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND}/dashboard`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err.message);
    res.status(500).json({ error: 'Failed to open billing portal.' });
  }
});

// ── Webhook ──────────────────────────────────────────────────────────────────

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(400).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    // Refuse to process unsigned webhooks — without a secret there is no way
    // to tell a real Stripe event from a forged request granting free access.
    console.error('Webhook rejected: STRIPE_WEBHOOK_SECRET is not set.');
    return res.status(400).send('Webhook not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send('Webhook Error');
  }

  // Idempotency: Stripe may deliver the same event more than once (retries,
  // duplicate delivery). Acknowledge duplicates without reprocessing so a
  // replay can never double-apply a plan change or double-charge state.
  if (wasWebhookEventProcessed(event.id)) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (userId && plan && PLAN_META[plan]) {
          updateUser(userId, { plan, stripeSubscriptionId: session.subscription, subscriptionStatus: 'active' });
          console.log(`  [webhook] ${userId} -> upgraded to ${plan}`);

          // Defense in depth against the /checkout route's active-subscription
          // check being raced (e.g. two rapid clicks before this user's row
          // reflects the first one) — cancel any OTHER active subscription
          // this Stripe customer has so they're never billed for more than
          // one plan at once, keeping only the one just completed.
          try {
            const existing = await stripe.subscriptions.list({ customer: session.customer, status: 'active', limit: 20 });
            for (const sub of existing.data) {
              if (sub.id !== session.subscription) {
                await stripe.subscriptions.cancel(sub.id);
                console.log(`  [webhook] canceled duplicate subscription ${sub.id} for ${userId}`);
              }
            }
          } catch (dupErr) {
            console.error('  [webhook] duplicate-subscription cleanup failed:', dupErr.message);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const user = findUserByStripeCustomer(sub.customer);
        if (!user) break;

        if (sub.status === 'active' || sub.status === 'trialing') {
          const plan = sub.items?.data?.[0]?.price?.metadata?.plan;
          updateUser(user.id, {
            ...(plan && PLAN_META[plan] ? { plan } : {}),
            stripeSubscriptionId: sub.id,
            subscriptionStatus: 'active',
          });
          console.log(`  [webhook] ${user.email} -> active${plan ? ` (${plan})` : ''}`);
        } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
          updateUser(user.id, { subscriptionStatus: 'past_due' });
          console.log(`  [webhook] ${user.email} -> past_due`);
        } else if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
          updateUser(user.id, { plan: 'free', stripeSubscriptionId: null, subscriptionStatus: 'canceled' });
          console.log(`  [webhook] ${user.email} -> downgraded to free (${sub.status})`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const user = findUserByStripeCustomer(sub.customer);
        if (user) {
          updateUser(user.id, { plan: 'free', stripeSubscriptionId: null, subscriptionStatus: 'canceled' });
          console.log(`  [webhook] ${user.email} -> downgraded to free (subscription cancelled)`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const user = findUserByStripeCustomer(invoice.customer);
        if (user) {
          updateUser(user.id, { subscriptionStatus: 'past_due' });
          console.log(`  [webhook] Payment failed for ${user.email} -> marked past_due`);
        }
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create') {
          const user = findUserByStripeCustomer(invoice.customer);
          if (user) {
            updateUser(user.id, { subscriptionStatus: 'active' });
            console.log(`  [webhook] Renewal payment succeeded for ${user.email} -> active`);
          }
        }
        break;
      }

      default:
        break;
    }

    markWebhookEventProcessed(event.id);
  } catch (err) {
    console.error(`Webhook handler error (${event.type}):`, err.message);
    // Do not mark as processed on failure — allow Stripe's retry to try again.
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  res.json({ received: true });
});

export { router as stripeRouter, PLAN_META };

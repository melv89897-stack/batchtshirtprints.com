import express from 'express';
import Stripe from 'stripe';

/**
 * createCheckoutRouter(store, config) — a Stripe Checkout "buy button"
 * backend, decoupled from any specific plan names or user schema.
 *
 * Required `store` methods:
 *   getCustomerId(user)                 -> string | null   (existing Stripe customer id, if any)
 *   saveCustomerId(userId, customerId)  -> void             (persist it after first checkout)
 *
 * Required `config`:
 *   stripeSecretKey — from your Stripe dashboard (test or live key)
 *   requireAuth     — your app's auth middleware; must set req.user = { id, email, name }
 *   prices          — { planKey: stripePriceId, ... } created in the Stripe dashboard
 *   successUrl / cancelUrl — where Stripe redirects after checkout
 *
 * Optional `config`:
 *   mode  (default 'subscription'; use 'payment' for one-time purchases)
 */
export function createCheckoutRouter(store, config) {
  const { stripeSecretKey, requireAuth, prices, successUrl, cancelUrl, mode = 'subscription' } = config;

  // What-if: this module gets wired up before Stripe keys exist yet (e.g.
  // local dev) — fail at request time with a clear 503, not a crash at boot.
  const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

  if (typeof requireAuth !== 'function') {
    throw new Error('createCheckoutRouter: config.requireAuth (an Express middleware) is required.');
  }
  if (!prices || Object.keys(prices).length === 0) {
    throw new Error('createCheckoutRouter: config.prices must map at least one plan key to a Stripe price id.');
  }
  if (!successUrl || !cancelUrl) {
    throw new Error('createCheckoutRouter: config.successUrl and config.cancelUrl are required.');
  }

  const router = express.Router();

  router.post('/checkout', requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Payments not configured.' });

    const { plan } = req.body;
    // What-if: caller sends a plan key that doesn't exist — never trust the
    // client to also send the price/amount.
    const priceId = prices[plan];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan.' });

    try {
      let customerId = await store.getCustomerId(req.user);
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          name: req.user.name || undefined,
          metadata: { userId: req.user.id },
        });
        customerId = customer.id;
        await store.saveCustomerId(req.user.id, customerId);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode,
        allow_promotion_codes: true,
        success_url: successUrl,
        cancel_url: cancelUrl,
        // Carried through to the webhook so it can identify who paid for
        // what without trusting anything the browser reports back directly.
        metadata: { userId: req.user.id, plan },
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error('Checkout error:', err.message);
      res.status(500).json({ error: 'Failed to start checkout. Please try again.' });
    }
  });

  router.post('/portal', requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Payments not configured.' });

    const customerId = await store.getCustomerId(req.user);
    // What-if: user has never paid, so has no Stripe customer to manage.
    if (!customerId) return res.status(400).json({ error: 'No active subscription found.' });

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: cancelUrl,
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error('Portal error:', err.message);
      res.status(500).json({ error: 'Failed to open billing portal.' });
    }
  });

  return router;
}

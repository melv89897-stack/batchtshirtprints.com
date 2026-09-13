import express from 'express';
import Stripe from 'stripe';

/**
 * createWebhookRouter(config) — verifies and dispatches Stripe webhook
 * events. This is the "payment confirmation listener": Stripe calls this
 * endpoint directly (not the browser), so it's the only place safe to
 * actually grant paid access.
 *
 * Required `config`:
 *   stripeSecretKey  — same key used for checkout
 *   webhookSecret    — from the Stripe dashboard's webhook endpoint settings
 *                       (starts with "whsec_"); NOT the same as the secret key
 *   handlers         — { 'checkout.session.completed': async (event) => {...}, ... }
 *                       Only wire up the event types you actually handle;
 *                       unlisted event types are safely ignored.
 *
 * Mount this BEFORE any express.json() body parser runs on this path —
 * Stripe signature verification needs the raw, unparsed request body.
 */
export function createWebhookRouter(config) {
  const { stripeSecretKey, webhookSecret, handlers = {} } = config;

  const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
  const router = express.Router();

  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) return res.status(400).send('Stripe not configured');

    // What-if: webhookSecret was never set (common in a rushed deploy) —
    // refuse everything rather than trust unsigned requests. Without this
    // check, anyone could POST a fake "payment succeeded" event and grant
    // themselves a paid plan for free.
    if (!webhookSecret) {
      console.error('Webhook rejected: webhookSecret is not configured.');
      return res.status(400).send('Webhook not configured');
    }

    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      // What-if: request isn't really from Stripe, or the payload was
      // tampered with in transit — signature check catches both.
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send('Webhook Error: invalid signature');
    }

    const handler = handlers[event.type];
    if (handler) {
      try {
        await handler(event);
      } catch (err) {
        // What-if: your own handler throws (e.g. a DB write fails) — log it
        // but still acknowledge receipt to Stripe. Returning a non-2xx here
        // makes Stripe retry the SAME event repeatedly, which can double-
        // apply side effects once the underlying bug is fixed; prefer fixing
        // forward and manually replaying from the Stripe dashboard if needed.
        console.error(`Webhook handler error (${event.type}):`, err.message);
      }
    }

    res.json({ received: true });
  });

  return router;
}

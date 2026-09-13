// One-time (idempotent) setup: creates the BATCH Starter ($4.99/mo) and
// BATCH Pro ($9.99/mo) Stripe Products+Prices if they don't already exist
// (matched by metadata.app === 'batch' AND metadata.plan, so re-running
// never duplicates them), then prints the price IDs to add to .env. If a
// product already exists at an old price (Stripe prices are immutable once
// created), this creates a fresh Price at the current amount and
// deactivates the stale one.
//
// The metadata.app tag matters: this Stripe account is shared with a
// sibling app (InkStorm) that independently tags its own products with
// metadata.plan values — matching on plan alone once caused this script to
// silently adopt InkStorm's leftover "Starter" product as BATCH's "pro"
// plan (correct price, wrong product name/branding at checkout).
//
// Usage: npm run setup:stripe
import 'dotenv/config';
import Stripe from 'stripe';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set in .env — nothing to do.');
  process.exit(1);
}

const stripe = new Stripe(SECRET_KEY);

const PLAN_META = {
  starter: { name: 'BATCH Starter', price: 499, description: '100 prints per month' },
  pro:     { name: 'BATCH Pro',     price: 999, description: '1000 prints per month' },
};

async function main() {
  const resolved = {};

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
      console.log(`Created product ${key}: ${product.id}`);
    }

    const activePrices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
    const current = activePrices.data.find(p => p.unit_amount === PLAN_META[key].price && p.recurring?.interval === 'month');

    if (current) {
      resolved[key] = current.id;
      console.log(`Found existing ${key} price at the current amount: ${current.id}`);
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: PLAN_META[key].price,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { app: 'batch', plan: key },
      });
      resolved[key] = price.id;
      console.log(`Created ${key}: product=${product.id} price=${price.id} (${PLAN_META[key].price}c)`);
      for (const stale of activePrices.data) {
        if (stale.id !== price.id) {
          await stripe.prices.update(stale.id, { active: false });
          console.log(`  deactivated stale price ${stale.id}`);
        }
      }
    }
  }

  console.log('\nAdd these to your .env:');
  console.log(`STRIPE_PRICE_STARTER=${resolved.starter}`);
  console.log(`STRIPE_PRICE_PRO=${resolved.pro}`);
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});

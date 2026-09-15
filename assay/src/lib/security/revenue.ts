import Stripe from "stripe";
import { db } from "@/lib/db";
import { audit } from "./audit";
import { assertCanManageListing } from "./authorize";
import type { User } from "@prisma/client";

/**
 * The trust moat: live revenue pulled from the source (Stripe), not an
 * uploaded screenshot. This is the one integration that's real rather than
 * stubbed even in this environment, because it's read-only (an account
 * balance/charge summary) — it never moves a dollar, so it doesn't carry the
 * money-transmission risk escrow.ts and kyc.ts are deliberately stubbed
 * against.
 *
 * Requires STRIPE_SECRET_KEY and the seller's own Stripe Connect account id
 * on their user row (stripeAccountId — set once Stripe Connect OAuth is
 * wired up). Without a key configured, listings run in demo mode: the
 * seller can still enter metrics for the UI to render, but `stripeVerified`
 * stays false and the hallmark seal will not show it as verified.
 */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function client(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });
}

/**
 * Pull trailing-30-day gross volume from the seller's connected Stripe
 * account as a live MRR proxy, and stamp the listing's `stripeVerified`
 * hallmark check if it succeeds.
 */
export async function verifyListingRevenue(actor: User, listingId: string) {
  await assertCanManageListing(actor, listingId);

  if (!stripeConfigured()) {
    throw new Error(
      "Live Stripe verification isn't configured in this environment — set STRIPE_SECRET_KEY to enable it.",
    );
  }

  const listing = await db.listing.findUniqueOrThrow({ where: { id: listingId } });
  const seller = await db.user.findUniqueOrThrow({ where: { id: listing.sellerId } });
  if (!seller.stripeAccountId) {
    throw new Error("Connect a Stripe account before requesting verification.");
  }

  const stripe = client();
  const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  let grossCents = 0;
  for await (const charge of stripe.charges.list(
    { created: { gte: since }, limit: 100 },
    { stripeAccount: seller.stripeAccountId },
  )) {
    if (charge.paid && !charge.refunded) grossCents += charge.amount;
  }

  const updated = await db.listing.update({
    where: { id: listingId },
    data: { stripeVerified: true, mrrCents: grossCents },
  });

  await audit({
    action: "listing.revenue_verified",
    actorId: actor.id,
    targetType: "Listing",
    targetId: listingId,
    metadata: { mrrCents: grossCents },
  });

  return updated;
}

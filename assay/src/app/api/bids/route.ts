import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { placeBidSchema } from "@/lib/security/validate";
import { assertCanBid } from "@/lib/security/authorize";
import { audit } from "@/lib/security/audit";

/**
 * PLACE A BID — the reference implementation every money/action route
 * copies. The guard already handled auth, 2FA, rate limiting, and
 * validation before we got here; we just do the business logic and
 * re-check eligibility + amount inside a transaction.
 *
 * Anti-snipe: a bid inside the final 2 minutes pushes the end time out by 2
 * minutes, so an auction can't be stolen in the last second.
 */
const ANTI_SNIPE_WINDOW_MS = 2 * 60 * 1000;

export const POST = withGuard(
  { rateLimit: "bid", requireTwoFactor: true, bodySchema: placeBidSchema },
  async ({ user, body, ip }) => {
    const result = await db.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: body.listingId } });
      if (!listing) throw new Error("Listing not found.");

      await assertCanBid(user, listing.id);

      const minimum = listing.currentBidCents + listing.bidIncrementCents;
      if (body.amountCents < minimum) {
        return { error: `Bid must be at least ${minimum} cents.`, minimumCents: minimum } as const;
      }

      let endsAt = listing.endsAt ?? undefined;
      let extended = false;
      if (endsAt && endsAt.getTime() - Date.now() < ANTI_SNIPE_WINDOW_MS) {
        endsAt = new Date(endsAt.getTime() + ANTI_SNIPE_WINDOW_MS);
        extended = true;
      }

      const bid = await tx.bid.create({
        data: {
          listingId: listing.id,
          bidderId: user.id,
          amountCents: body.amountCents,
          isProxyMax: body.isProxyMax,
        },
      });

      await tx.listing.update({
        where: { id: listing.id },
        data: { currentBidCents: body.amountCents, ...(endsAt ? { endsAt } : {}) },
      });

      return { bid, currentBidCents: body.amountCents, endsAt, extended } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error, minimumCents: result.minimumCents }, { status: 400 });
    }

    await audit({
      action: "bid.placed",
      actorId: user.id,
      targetType: "Listing",
      targetId: body.listingId,
      ipAddress: ip,
      metadata: { amountCents: body.amountCents, antiSnipeExtended: result.extended },
    });

    return NextResponse.json({
      ok: true,
      currentBidCents: result.currentBidCents,
      endsAt: result.endsAt,
      antiSnipeExtended: result.extended,
    });
  },
);

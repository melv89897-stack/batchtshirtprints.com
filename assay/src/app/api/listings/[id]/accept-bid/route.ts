import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { assertCanManageListing } from "@/lib/security/authorize";
import { openEscrowDeal } from "@/lib/security/escrow";
import { audit } from "@/lib/security/audit";

/**
 * Seller accepts the current high bid once the auction has ended (or on a
 * Buy-It-Now), moving the deal into escrow. This is the only path that turns
 * a Listing + winning Bid into an EscrowDeal.
 */
export const POST = withGuard<undefined>({ requireTwoFactor: true }, async ({ user, req }) => {
  const id = req.nextUrl.pathname.split("/").slice(-2, -1)[0];
  await assertCanManageListing(user, id);

  const listing = await db.listing.findUniqueOrThrow({
    where: { id },
    include: { bids: { orderBy: { amountCents: "desc" }, take: 1 } },
  });

  if (listing.endsAt && listing.endsAt > new Date()) {
    return NextResponse.json({ error: "The auction hasn't ended yet." }, { status: 400 });
  }
  const winningBid = listing.bids[0];
  if (!winningBid) {
    return NextResponse.json({ error: "No bids to accept." }, { status: 400 });
  }
  if (listing.status !== "LIVE") {
    return NextResponse.json({ error: "This listing isn't awaiting acceptance." }, { status: 400 });
  }

  const deal = await openEscrowDeal({
    listingId: listing.id,
    buyerId: winningBid.bidderId,
    sellerId: listing.sellerId,
    amountCents: winningBid.amountCents,
  });

  await audit({ action: "listing.bid_accepted", actorId: user.id, targetType: "Listing", targetId: id });
  return NextResponse.json({ ok: true, deal });
});

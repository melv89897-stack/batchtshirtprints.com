import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { createListingSchema } from "@/lib/security/validate";
import { audit } from "@/lib/security/audit";

/** Public feed of sealed listings — codename + verified badges only, never realName/domain. */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "LIVE";
  const category = req.nextUrl.searchParams.get("category");

  const listings = await db.listing.findMany({
    where: {
      status: status === "ALL" ? undefined : (status as never),
      category: category ?? undefined,
    },
    select: {
      id: true,
      codename: true,
      category: true,
      summary: true,
      status: true,
      askType: true,
      reservePriceCents: true,
      buyNowPriceCents: true,
      currentBidCents: true,
      bidIncrementCents: true,
      endsAt: true,
      mrrCents: true,
      growthMoM: true,
      arrMultiple: true,
      stripeVerified: true,
      analyticsVerified: true,
      statementRedacted: true,
      depositsMatched: true,
      _count: { select: { bids: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ listings });
}

/** Create a new (draft) listing. Requires 2FA — listing a company moves toward money. */
export const POST = withGuard(
  { requireTwoFactor: true, bodySchema: createListingSchema },
  async ({ user, body }) => {
    const listing = await db.listing.create({
      data: {
        sellerId: user.id,
        codename: body.codename,
        category: body.category,
        realName: body.realName,
        domain: body.domain,
        summary: body.summary,
        askType: body.askType,
        reservePriceCents: body.reservePriceCents,
        buyNowPriceCents: body.buyNowPriceCents,
        bidIncrementCents: body.bidIncrementCents ?? 2_500_000,
        mrrCents: body.mrrCents,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        status: "DRAFT",
      },
    });

    await audit({ action: "listing.created", actorId: user.id, targetType: "Listing", targetId: listing.id });

    return NextResponse.json({ ok: true, listing });
  },
);

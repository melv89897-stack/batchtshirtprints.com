import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security/auth";
import { hasSignedNda } from "@/lib/security/authorize";

/**
 * Listing detail. realName/domain/documents only appear once the viewer has
 * signed the NDA (or is the seller/an admin) — the sealed-listing rule
 * enforced on the server, not hidden with CSS.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const listing = await db.listing.findUnique({
    where: { id: params.id },
    include: {
      bids: { orderBy: { amountCents: "desc" }, take: 20, include: { bidder: { select: { displayName: true, id: true } } } },
      documents: { select: { id: true, type: true, createdAt: true } },
      seller: { select: { id: true, displayName: true, reputationScore: true } },
    },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  const viewer = await getCurrentUser();
  const isOwnerOrAdmin = viewer && (viewer.id === listing.sellerId || viewer.role === "ADMIN");
  const ndaSigned = viewer ? await hasSignedNda(viewer.id, listing.id) : false;
  const unlocked = Boolean(isOwnerOrAdmin || ndaSigned);

  return NextResponse.json({
    listing: {
      ...listing,
      realName: unlocked ? listing.realName : null,
      domain: unlocked ? listing.domain : null,
      documents: unlocked ? listing.documents : [],
    },
    unlocked,
  });
}

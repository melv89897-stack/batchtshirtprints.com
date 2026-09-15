import { db } from "@/lib/db";
import type { User } from "@prisma/client";

/**
 * Authorization layer — answers "is this user allowed to do this, right now?"
 * Every check runs on the SERVER. A hidden or disabled button in the UI is
 * not security; these functions are.
 */
export class ForbiddenError extends Error {
  constructor(
    public reason: string,
    public details?: Record<string, unknown>,
  ) {
    super(reason);
    this.name = "ForbiddenError";
  }
}

/** Has the user signed the NDA for this listing? Unlocks realName, domain, docs. */
export async function hasSignedNda(userId: string, listingId: string): Promise<boolean> {
  const nda = await db.nda.findUnique({
    where: { listingId_signerId: { listingId, signerId: userId } },
  });
  return Boolean(nda);
}

export async function assertCanAccessDataRoom(user: User, listingId: string): Promise<void> {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new ForbiddenError("Listing not found.");
  if (listing.sellerId === user.id || user.role === "ADMIN") return;
  if (await hasSignedNda(user.id, listingId)) return;
  throw new ForbiddenError("Sign the NDA to open this data room.");
}

/**
 * Can this user place a bid on this listing? All must be true:
 *  - KYC verified
 *  - proof of funds verified
 *  - has signed the NDA (been inside the data room)
 *  - listing is LIVE
 *  - user is not the seller
 */
export async function assertCanBid(user: User, listingId: string): Promise<void> {
  if (user.kycStatus !== "VERIFIED")
    throw new ForbiddenError("Complete identity verification (KYC) before bidding.");
  if (user.proofOfFundsStatus !== "VERIFIED")
    throw new ForbiddenError("Verify proof of funds before bidding.");

  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new ForbiddenError("Listing not found.");
  if (listing.status !== "LIVE") throw new ForbiddenError("This auction is not live.");
  if (listing.sellerId === user.id) throw new ForbiddenError("You cannot bid on your own listing.");

  if (!(await hasSignedNda(user.id, listingId)))
    throw new ForbiddenError("Sign the NDA before bidding.");
}

/** Does the user own this listing (or is an admin)? */
export async function assertCanManageListing(user: User, listingId: string): Promise<void> {
  if (user.role === "ADMIN") return;
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.sellerId !== user.id)
    throw new ForbiddenError("You don't have access to this listing.");
}

/** Can the user read/post in this listing's private data-room Q&A? Seller, any
 *  buyer who signed the NDA, or an admin. */
export async function assertCanMessageListing(user: User, listingId: string): Promise<void> {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new ForbiddenError("Listing not found.");
  if (listing.sellerId === user.id || user.role === "ADMIN") return;
  if (await hasSignedNda(user.id, listingId)) return;
  throw new ForbiddenError("Sign the NDA before messaging the seller.");
}

/**
 * Can escrow be released to the seller? Requires ALL of:
 *  - every handover item confirmed
 *  - the 7-day inspection window has closed
 *  - no open dispute
 * Enforced here, never in the UI. Re-checked again inside escrow.ts at the
 * moment of release — this function alone is not the last line of defense.
 */
export async function assertCanReleaseEscrow(dealId: string): Promise<void> {
  const deal = await db.escrowDeal.findUnique({
    where: { id: dealId },
    include: { handoverItems: true, disputes: true },
  });
  if (!deal) throw new ForbiddenError("Deal not found.");

  const openDispute = deal.disputes.some((d) => d.status !== "RESOLVED");
  if (openDispute) throw new ForbiddenError("An open dispute is blocking release.");

  const allConfirmed = deal.handoverItems.length > 0 && deal.handoverItems.every((i) => i.done);
  if (!allConfirmed)
    throw new ForbiddenError("All handover items must be confirmed before release.");

  if (!deal.inspectionEndsAt || deal.inspectionEndsAt > new Date())
    throw new ForbiddenError("The 7-day inspection window has not closed yet.");

  if (deal.status === "RELEASED")
    throw new ForbiddenError("Funds have already been released.");
}

/** Buyer or seller on a deal (or admin) — used for handover/dispute actions. */
export async function assertIsDealParty(user: User, dealId: string): Promise<void> {
  if (user.role === "ADMIN") return;
  const deal = await db.escrowDeal.findUnique({ where: { id: dealId } });
  if (!deal || (deal.buyerId !== user.id && deal.sellerId !== user.id)) {
    throw new ForbiddenError("You don't have access to this deal.");
  }
}

export function assertIsAdmin(user: User): void {
  if (user.role !== "ADMIN") throw new ForbiddenError("Admin access required.");
}

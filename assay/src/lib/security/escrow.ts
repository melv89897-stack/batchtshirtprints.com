import { db } from "@/lib/db";
import { audit } from "./audit";
import { ForbiddenError, assertCanReleaseEscrow, assertIsDealParty } from "./authorize";
import type { User } from "@prisma/client";

/**
 * Money release is the single most sensitive action on the platform. The
 * rule is enforced HERE, in server code — not in the UI:
 *
 *   Funds release to the seller only when
 *     (a) every handover item is confirmed, AND
 *     (b) the 7-day buyer inspection window has closed, AND
 *     (c) no dispute is open.
 *
 * This module is the ONLY path that moves an EscrowDeal between states.
 *
 * ESCROW_MODE=stub (the default) runs this exact state machine against the
 * database with no external call — every rule above is fully enforced and
 * testable. ESCROW_MODE=stripe is where a real Stripe Connect transfer would
 * be made once a lawyer has signed off on money-transmission/escrow
 * obligations (see assay/README.md) — swap the two TODOs below for the real
 * API calls and nothing else in the app has to change, since every caller
 * only ever goes through this module.
 */
const INSPECTION_DAYS = 7;

function escrowMode(): "stub" | "stripe" {
  return process.env.ESCROW_MODE === "stripe" ? "stripe" : "stub";
}

/** Buyer's winning bid moves into escrow: funds are (simulated as) secured. */
export async function openEscrowDeal(params: {
  listingId: string;
  buyerId: string;
  sellerId: string;
  amountCents: number;
}) {
  const platformFeeCents = Math.round(params.amountCents * 0.1); // flat 10% deal fee

  if (escrowMode() === "stripe") {
    // TODO: create the real PaymentIntent / Stripe Connect transfer-group here.
  }

  const deal = await db.escrowDeal.create({
    data: {
      listingId: params.listingId,
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      amountCents: params.amountCents,
      platformFeeCents,
      status: "FUNDS_SECURED",
      handoverItems: {
        create: [
          { label: "GitHub repositories" },
          { label: "Hosting / infra access" },
          { label: "Domain transfer" },
          { label: "Stripe / billing account" },
          { label: "Credentials & secrets" },
        ],
      },
    },
    include: { handoverItems: true },
  });

  await db.listing.update({ where: { id: params.listingId }, data: { status: "IN_ESCROW" } });

  await audit({
    action: "escrow.opened",
    actorId: params.buyerId,
    targetType: "EscrowDeal",
    targetId: deal.id,
    metadata: { amountCents: params.amountCents, platformFeeCents, mode: escrowMode() },
  });

  return deal;
}

export async function toggleHandoverItem(actor: User, itemId: string, done: boolean) {
  const item = await db.handoverItem.findUnique({ where: { id: itemId }, include: { deal: true } });
  if (!item) throw new Error("Handover item not found.");
  await assertIsDealParty(actor, item.dealId);
  if (actor.role !== "ADMIN" && item.deal.sellerId !== actor.id) {
    throw new ForbiddenError("Only the seller confirms a handover item was transferred.");
  }

  const updated = await db.handoverItem.update({
    where: { id: itemId },
    data: { done, confirmedAt: done ? new Date() : null },
  });

  await audit({
    action: done ? "handover.item_confirmed" : "handover.item_unconfirmed",
    actorId: actor.id,
    targetType: "EscrowDeal",
    targetId: item.dealId,
    metadata: { itemId, label: item.label },
  });

  return updated;
}

/** Buyer confirms all assets received → starts the inspection countdown. */
export async function confirmHandoverComplete(actor: User, dealId: string) {
  const deal = await db.escrowDeal.findUnique({
    where: { id: dealId },
    include: { handoverItems: true },
  });
  if (!deal) throw new Error("Deal not found.");
  if (deal.buyerId !== actor.id && actor.role !== "ADMIN") {
    throw new ForbiddenError("Only the buyer can confirm handover.");
  }

  const allDone = deal.handoverItems.length > 0 && deal.handoverItems.every((i) => i.done);
  if (!allDone) throw new ForbiddenError("Not every asset has been transferred yet.");

  const inspectionEndsAt = new Date(Date.now() + INSPECTION_DAYS * 24 * 60 * 60 * 1000);
  const updated = await db.escrowDeal.update({
    where: { id: dealId },
    data: { status: "INSPECTION", inspectionEndsAt },
  });

  await audit({
    action: "escrow.handover_confirmed",
    actorId: actor.id,
    targetType: "EscrowDeal",
    targetId: dealId,
    metadata: { inspectionEndsAt },
  });
  return updated;
}

/**
 * Release funds to the seller. Guarded by all conditions, re-verified here
 * (never trust prior state alone) regardless of the caller.
 */
export async function releaseEscrow(dealId: string, actor?: User) {
  await assertCanReleaseEscrow(dealId);

  if (escrowMode() === "stripe") {
    // TODO: perform the real Stripe Connect transfer here, inside this guard.
    // await stripe.transfers.create({ ... })
  }

  const updated = await db.escrowDeal.update({
    where: { id: dealId },
    data: { status: "RELEASED", fundsReleasedAt: new Date() },
  });

  await db.listing.update({ where: { id: updated.listingId }, data: { status: "SOLD" } });

  await Promise.all([
    db.user.update({ where: { id: updated.sellerId }, data: { reputationScore: { increment: 10 } } }),
    db.user.update({ where: { id: updated.buyerId }, data: { reputationScore: { increment: 5 } } }),
  ]);

  await audit({
    action: "escrow.released",
    actorId: actor?.id ?? null,
    targetType: "EscrowDeal",
    targetId: dealId,
    metadata: { amountCents: updated.amountCents, mode: escrowMode() },
  });
  return updated;
}

/** Refund the buyer instead (dispute resolved in their favor, or a clean cancel). */
export async function refundEscrow(dealId: string, actor?: User) {
  const deal = await db.escrowDeal.findUnique({ where: { id: dealId } });
  if (!deal) throw new Error("Deal not found.");
  if (deal.status === "RELEASED") throw new ForbiddenError("Funds already released — cannot refund.");

  if (escrowMode() === "stripe") {
    // TODO: perform the real Stripe refund here.
  }

  const updated = await db.escrowDeal.update({ where: { id: dealId }, data: { status: "REFUNDED" } });
  await db.listing.update({ where: { id: updated.listingId }, data: { status: "WITHDRAWN" } });

  await audit({
    action: "escrow.refunded",
    actorId: actor?.id ?? null,
    targetType: "EscrowDeal",
    targetId: dealId,
    metadata: { amountCents: updated.amountCents, mode: escrowMode() },
  });
  return updated;
}

/**
 * A dispute freezes a deal — funds cannot move until an admin resolves it,
 * regardless of handover/inspection state.
 */
export async function freezeDealForDispute(dealId: string) {
  return db.escrowDeal.update({ where: { id: dealId }, data: { status: "DISPUTED" } });
}

/**
 * Admin resolves a dispute and settles the deal directly. This is the one
 * deliberate override of the normal releaseEscrow()/refundEscrow() gates
 * (inspection-closed, all-handover-done): a dispute resolution IS the
 * exception process the reviewer is empowered to short-circuit. SPLIT is
 * recorded but not auto-settled — this schema has no partial-release model,
 * so a split outcome is handled off-platform and the deal is simply
 * unfrozen back to INSPECTION so a follow-up release/refund can complete it.
 */
export async function settleDisputedDeal(
  admin: User,
  dealId: string,
  resolution: "REFUND_BUYER" | "RELEASE_SELLER" | "SPLIT",
) {
  if (escrowMode() === "stripe") {
    // TODO: perform the real Stripe transfer/refund for this resolution here.
  }

  if (resolution === "REFUND_BUYER") {
    const updated = await db.escrowDeal.update({ where: { id: dealId }, data: { status: "REFUNDED" } });
    await db.listing.update({ where: { id: updated.listingId }, data: { status: "WITHDRAWN" } });
    await audit({ action: "escrow.dispute_resolved_refund", actorId: admin.id, targetType: "EscrowDeal", targetId: dealId });
    return updated;
  }

  if (resolution === "RELEASE_SELLER") {
    const updated = await db.escrowDeal.update({
      where: { id: dealId },
      data: { status: "RELEASED", fundsReleasedAt: new Date() },
    });
    await db.listing.update({ where: { id: updated.listingId }, data: { status: "SOLD" } });
    await audit({ action: "escrow.dispute_resolved_release", actorId: admin.id, targetType: "EscrowDeal", targetId: dealId });
    return updated;
  }

  const updated = await db.escrowDeal.update({ where: { id: dealId }, data: { status: "INSPECTION" } });
  await audit({ action: "escrow.dispute_resolved_split", actorId: admin.id, targetType: "EscrowDeal", targetId: dealId });
  return updated;
}

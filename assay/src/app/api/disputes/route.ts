import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { createDisputeSchema } from "@/lib/security/validate";
import { assertIsDealParty, ForbiddenError } from "@/lib/security/authorize";
import { freezeDealForDispute } from "@/lib/security/escrow";
import { audit } from "@/lib/security/audit";

/** Buyer raises a dispute during inspection. Freezes the deal immediately. */
export const POST = withGuard({ requireTwoFactor: true, bodySchema: createDisputeSchema }, async ({ user, body }) => {
  await assertIsDealParty(user, body.dealId);

  const deal = await db.escrowDeal.findUniqueOrThrow({ where: { id: body.dealId } });
  if (deal.buyerId !== user.id) {
    return NextResponse.json({ error: "Only the buyer can raise a dispute." }, { status: 403 });
  }
  if (deal.status !== "INSPECTION" && deal.status !== "TRANSFERRING") {
    return NextResponse.json(
      { error: "Disputes can only be raised during handover or the inspection window." },
      { status: 400 },
    );
  }

  const dispute = await db.dispute.create({
    data: { dealId: body.dealId, raiserId: user.id, reason: body.reason },
  });
  await freezeDealForDispute(body.dealId);

  await audit({ action: "dispute.raised", actorId: user.id, targetType: "EscrowDeal", targetId: body.dealId });

  return NextResponse.json({ ok: true, dispute });
});

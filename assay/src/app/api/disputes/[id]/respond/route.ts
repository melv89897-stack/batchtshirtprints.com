import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { respondDisputeSchema } from "@/lib/security/validate";
import { assertIsDealParty } from "@/lib/security/authorize";
import { audit } from "@/lib/security/audit";

/** Seller responds to an open dispute before the reviewer decides. */
export const POST = withGuard({ requireTwoFactor: true, bodySchema: respondDisputeSchema }, async ({ user, body }) => {
  const dispute = await db.dispute.findUniqueOrThrow({ where: { id: body.disputeId }, include: { deal: true } });
  await assertIsDealParty(user, dispute.dealId);
  if (dispute.deal.sellerId !== user.id) {
    return NextResponse.json({ error: "Only the seller can respond to this dispute." }, { status: 403 });
  }
  if (dispute.status !== "OPEN") {
    return NextResponse.json({ error: "This dispute already has a response." }, { status: 400 });
  }

  const updated = await db.dispute.update({
    where: { id: body.disputeId },
    data: { sellerResponse: body.response, status: "SELLER_RESPONDED", respondedAt: new Date() },
  });

  await audit({ action: "dispute.responded", actorId: user.id, targetType: "EscrowDeal", targetId: dispute.dealId });

  return NextResponse.json({ ok: true, dispute: updated });
});

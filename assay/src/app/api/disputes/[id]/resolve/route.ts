import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { resolveDisputeSchema } from "@/lib/security/validate";
import { assertIsAdmin } from "@/lib/security/authorize";
import { settleDisputedDeal } from "@/lib/security/escrow";
import { audit } from "@/lib/security/audit";

/** Neutral Assay reviewer (admin) decides: refund / release / split. Judged
 *  against the verified record — the reason, seller response, and the
 *  listing's own hallmark data are all shown to the admin on the UI side. */
export const POST = withGuard({ requireTwoFactor: true, bodySchema: resolveDisputeSchema }, async ({ user, body }) => {
  assertIsAdmin(user);

  const dispute = await db.dispute.findUniqueOrThrow({ where: { id: body.disputeId } });
  if (dispute.status === "RESOLVED") {
    return NextResponse.json({ error: "This dispute is already resolved." }, { status: 400 });
  }

  await settleDisputedDeal(user, dispute.dealId, body.resolution);

  const updated = await db.dispute.update({
    where: { id: body.disputeId },
    data: {
      status: "RESOLVED",
      resolution: body.resolution,
      resolutionNote: body.note,
      resolvedById: user.id,
      resolvedAt: new Date(),
    },
  });

  await audit({
    action: "dispute.resolved",
    actorId: user.id,
    targetType: "EscrowDeal",
    targetId: dispute.dealId,
    metadata: { resolution: body.resolution },
  });

  return NextResponse.json({ ok: true, dispute: updated });
});

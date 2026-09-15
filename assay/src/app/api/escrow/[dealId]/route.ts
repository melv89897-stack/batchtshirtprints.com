import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/security/auth";
import { assertIsDealParty, ForbiddenError } from "@/lib/security/authorize";

export async function GET(_req: Request, { params }: { params: { dealId: string } }) {
  try {
    const user = await requireUser();
    await assertIsDealParty(user, params.dealId);

    const deal = await db.escrowDeal.findUniqueOrThrow({
      where: { id: params.dealId },
      include: {
        handoverItems: true,
        disputes: { orderBy: { createdAt: "desc" } },
        listing: { select: { codename: true, realName: true } },
        buyer: { select: { id: true, displayName: true } },
        seller: { select: { id: true, displayName: true } },
      },
    });
    return NextResponse.json({ deal });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.reason }, { status: 403 });
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
}

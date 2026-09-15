import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { sendMessageSchema } from "@/lib/security/validate";
import { assertCanMessageListing } from "@/lib/security/authorize";
import { requireUser } from "@/lib/security/auth";
import { audit } from "@/lib/security/audit";

/** Private data-room Q&A — logged, never public. Readable by the seller,
 *  admins, and any buyer who has signed the NDA for this listing. */
export async function GET(req: NextRequest) {
  const listingId = req.nextUrl.searchParams.get("listingId");
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });

  const user = await requireUser();
  await assertCanMessageListing(user, listingId);

  const messages = await db.dealMessage.findMany({
    where: { listingId },
    include: { sender: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages });
}

export const POST = withGuard({ bodySchema: sendMessageSchema }, async ({ user, body, ip }) => {
  await assertCanMessageListing(user, body.listingId);

  const message = await db.dealMessage.create({
    data: { listingId: body.listingId, senderId: user.id, body: body.body },
  });

  await audit({
    action: "message.sent",
    actorId: user.id,
    targetType: "Listing",
    targetId: body.listingId,
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, message });
});

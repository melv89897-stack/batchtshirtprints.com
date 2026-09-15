import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { signNdaSchema } from "@/lib/security/validate";
import { audit } from "@/lib/security/audit";

/** Signing the NDA unlocks realName, domain, documents, and messaging for one listing. */
export const POST = withGuard({ requireTwoFactor: true, bodySchema: signNdaSchema }, async ({ user, body, ip }) => {
  const listing = await db.listing.findUnique({ where: { id: body.listingId } });
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if (listing.sellerId === user.id) {
    return NextResponse.json({ error: "You already own this listing." }, { status: 400 });
  }

  const nda = await db.nda.upsert({
    where: { listingId_signerId: { listingId: body.listingId, signerId: user.id } },
    create: { listingId: body.listingId, signerId: user.id, ipAddress: ip },
    update: {},
  });

  await audit({
    action: "nda.signed",
    actorId: user.id,
    targetType: "Listing",
    targetId: body.listingId,
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, nda });
});

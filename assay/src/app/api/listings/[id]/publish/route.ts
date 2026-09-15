import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { assertCanManageListing } from "@/lib/security/authorize";
import { audit } from "@/lib/security/audit";

/** Seller moves a DRAFT listing live. Requires an ends-at (it's an auction). */
export const POST = withGuard<undefined>(
  { requireTwoFactor: true },
  async ({ user, req }) => {
    const id = req.nextUrl.pathname.split("/").slice(-2, -1)[0];
    await assertCanManageListing(user, id);

    const listing = await db.listing.findUniqueOrThrow({ where: { id } });
    const endsAt = listing.endsAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await db.listing.update({
      where: { id },
      data: { status: "LIVE", startsAt: new Date(), endsAt },
    });

    await audit({ action: "listing.published", actorId: user.id, targetType: "Listing", targetId: id });
    return NextResponse.json({ ok: true, listing: updated });
  },
);

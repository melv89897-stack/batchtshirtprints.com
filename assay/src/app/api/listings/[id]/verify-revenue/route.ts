import { NextResponse } from "next/server";
import { withGuard } from "@/lib/security/guard";
import { verifyListingRevenue } from "@/lib/security/revenue";

export const POST = withGuard<undefined>({ requireTwoFactor: true }, async ({ user, req }) => {
  const id = req.nextUrl.pathname.split("/").slice(-2, -1)[0];
  try {
    const listing = await verifyListingRevenue(user, id);
    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
});

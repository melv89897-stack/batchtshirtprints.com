import { NextResponse } from "next/server";
import { withGuard } from "@/lib/security/guard";
import { confirmHandoverComplete } from "@/lib/security/escrow";
import { ForbiddenError } from "@/lib/security/authorize";

export const POST = withGuard<undefined>({ requireTwoFactor: true }, async ({ user, req }) => {
  const dealId = req.nextUrl.pathname.split("/").slice(-2, -1)[0];
  try {
    const deal = await confirmHandoverComplete(user, dealId);
    return NextResponse.json({ ok: true, deal });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.reason }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
});

import { NextResponse } from "next/server";
import { withGuard } from "@/lib/security/guard";
import { assertIsAdmin } from "@/lib/security/authorize";
import { releaseEscrow } from "@/lib/security/escrow";
import { ForbiddenError } from "@/lib/security/authorize";

/**
 * Manually release escrow. In production this is a scheduled job that fires
 * the instant the inspection window closes with no open dispute; here it's
 * an admin action so the whole flow is demonstrable without a cron worker.
 * Every rule (handover complete, inspection closed, no open dispute) is
 * still re-checked inside releaseEscrow() regardless of who calls it.
 */
export const POST = withGuard<undefined>({ requireTwoFactor: true }, async ({ user, req }) => {
  assertIsAdmin(user);
  const dealId = req.nextUrl.pathname.split("/").slice(-2, -1)[0];
  try {
    const deal = await releaseEscrow(dealId, user);
    return NextResponse.json({ ok: true, deal });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.reason }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
});

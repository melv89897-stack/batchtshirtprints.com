import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { z } from "zod";

/**
 * Attach a Stripe Connect account id to the signed-in seller. A production
 * build would replace this with Stripe Connect OAuth (redirect → callback
 * stores the account id from Stripe's response); this direct-entry form
 * exists so live revenue verification (revenue.ts) can be exercised without
 * standing up the full OAuth app/redirect URLs this environment has no
 * public domain to receive.
 */
const schema = z.object({ stripeAccountId: z.string().startsWith("acct_") });

export const POST = withGuard({ bodySchema: schema }, async ({ user, body }) => {
  await db.user.update({ where: { id: user.id }, data: { stripeAccountId: body.stripeAccountId } });
  return NextResponse.json({ ok: true });
});

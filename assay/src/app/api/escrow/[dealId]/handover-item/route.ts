import { NextResponse } from "next/server";
import { withGuard } from "@/lib/security/guard";
import { handoverItemToggleSchema } from "@/lib/security/validate";
import { toggleHandoverItem } from "@/lib/security/escrow";
import { ForbiddenError } from "@/lib/security/authorize";

export const POST = withGuard({ requireTwoFactor: true, bodySchema: handoverItemToggleSchema }, async ({ user, body }) => {
  try {
    const item = await toggleHandoverItem(user, body.itemId, body.done);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.reason }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
});

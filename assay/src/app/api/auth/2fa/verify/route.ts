import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, verifyTotpCode, AuthError } from "@/lib/security/auth";
import { parse, ValidationError, totpVerifySchema } from "@/lib/security/validate";
import { audit } from "@/lib/security/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = parse(totpVerifySchema, await req.json().catch(() => ({})));

    if (!user.totpSecret || !verifyTotpCode(user.totpSecret, body.code)) {
      return NextResponse.json({ error: "That code didn't match. Try again." }, { status: 400 });
    }

    await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    await audit({ action: "auth.2fa_enabled", actorId: user.id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[auth/2fa/verify]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

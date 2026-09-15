import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, verifyPassword, AuthError } from "@/lib/security/auth";
import { parse, ValidationError } from "@/lib/security/validate";
import { z } from "zod";
import { audit } from "@/lib/security/audit";

const schema = z.object({ password: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = parse(schema, await req.json().catch(() => ({})));

    if (!(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    await db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, totpSecret: null },
    });
    await audit({ action: "auth.2fa_disabled", actorId: user.id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[auth/2fa/disable]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
